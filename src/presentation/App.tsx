import React, { useCallback, useEffect, useState } from 'react';
import {
  CATEGORIAS_PRODUTO,
  METODOS_PAGAMENTO,
  MINUTO_MS,
  RelogioAjustavel,
  formatarBRL,
  reaisParaCentavos,
  type CategoriaProduto,
  type MetodoPagamento,
  type Produto,
  type RelatorioFechamento,
} from '../domain';
import {
  BrowserLocalStorage,
  CREDENCIAIS_HOMOLOGACAO,
  SQLiteEngine,
} from '../infrastructure';
import { BasilicoSystemFacade, CHAVE_AES_PADRAO_SISTEMA } from '../application';
import { tocarAlertaSonoroDelivery } from './audio/soundAlert';

type AbaAtiva = 'PDV' | 'DELIVERY' | 'VENDAS_CAIXA' | 'INSPETOR';

interface NotificacaoToast {
  id: number;
  tipo: 'SUCESSO' | 'ALERTA' | 'ERRO' | 'INFO';
  titulo: string;
  mensagem: string;
}

const relogioGlobal = new RelogioAjustavel();
const storageNavegador = new BrowserLocalStorage();

export function App(): React.ReactElement {
  const [sistema, setSistema] = useState<BasilicoSystemFacade | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroInicializacao, setErroInicializacao] = useState<string | null>(null);
  const [versaoUi, setVersaoUi] = useState(0);

  // Estado de Login
  const [loginInput, setLoginInput] = useState<string>(CREDENCIAIS_HOMOLOGACAO.operador.login);
  const [senhaInput, setSenhaInput] = useState<string>(CREDENCIAIS_HOMOLOGACAO.operador.senhaPura);
  const [erroLogin, setErroLogin] = useState<string | null>(null);

  // Navegação e Filtros PDV
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('PDV');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaProduto | 'TODAS'>('TODAS');
  const [descontoInputReais, setDescontoInputReais] = useState<string>('0,00');
  const [metodoSelecionado, setMetodoSelecionado] = useState<MetodoPagamento>('PIX');

  // Modal CRUD Produto (Nível Intermediário)
  const [modalProdutoAberto, setModalProdutoAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [prodNome, setProdNome] = useState('');
  const [prodDescricao, setProdDescricao] = useState('');
  const [prodCategoria, setProdCategoria] = useState<CategoriaProduto>('MASSAS');
  const [prodPrecoReais, setProdPrecoReais] = useState('49,90');

  // Modal Estorno RBAC (RN02)
  const [vendaAlvoEstorno, setVendaAlvoEstorno] = useState<string | null>(null);
  const [motivoEstorno, setMotivoEstorno] = useState('');
  const [loginGerenteModal, setLoginGerenteModal] = useState<string>(CREDENCIAIS_HOMOLOGACAO.gerente.login);
  const [senhaGerenteModal, setSenhaGerenteModal] = useState<string>(CREDENCIAIS_HOMOLOGACAO.gerente.senhaPura);

  // Modal Recusa Delivery
  const [pedidoAlvoRecusa, setPedidoAlvoRecusa] = useState<string | null>(null);
  const [motivoRecusaDelivery, setMotivoRecusaDelivery] = useState('Ingrediente em falta na cozinha');

  // Modal Abertura de Caixa e Último Relatório de Fechamento
  const [saldoAberturaReais, setSaldoAberturaReais] = useState('250,00');
  const [ultimoFechamento, setUltimoFechamento] = useState<RelatorioFechamento | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<NotificacaoToast[]>([]);

  const atualizarTela = useCallback(() => {
    setVersaoUi((v) => v + 1);
  }, []);

  const adicionarToast = useCallback(
    (tipo: NotificacaoToast['tipo'], titulo: string, mensagem: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((prev) => [{ id, tipo, titulo, mensagem }, ...prev.slice(0, 4)]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 6500);
    },
    [],
  );

  useEffect(() => {
    let cancelado = false;
    async function inicializar(): Promise<void> {
      try {
        const instancia = await BasilicoSystemFacade.criar({
          storage: storageNavegador,
          nomeBanco: 'basilico.pdv.web',
          chaveCifragem: CHAVE_AES_PADRAO_SISTEMA,
          relogio: relogioGlobal,
        });
        if (cancelado) return;
        instancia.caixa.aoMudarEstado(() => atualizarTela());
        setSistema(instancia);
        setCarregando(false);
      } catch (e) {
        if (cancelado) return;
        setErroInicializacao(e instanceof Error ? e.message : String(e));
        setCarregando(false);
      }
    }
    void inicializar();
    return () => {
      cancelado = true;
    };
  }, [atualizarTela]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mb-4" />
        <h1 className="text-xl font-bold text-emerald-400">Inicializando Motor Híbrido Basílico...</h1>
        <p className="text-sm text-slate-400 mt-1">
          Carregando SQLite WebAssembly (Modo WAL) + Camada AES-256-GCM (SQLCipher)
        </p>
      </div>
    );
  }

  if (erroInicializacao || !sistema) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full bg-red-950/60 border border-red-500/60 rounded-xl p-6">
          <h2 className="text-lg font-bold text-red-300">Erro ao inicializar banco local cifrado</h2>
          <p className="text-sm text-red-200 mt-2">{erroInicializacao}</p>
          <button
            onClick={() => {
              SQLiteEngine.apagarArmazenamento(storageNavegador, 'basilico.pdv.web');
              window.location.reload();
            }}
            className="mt-4 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-sm cursor-pointer"
          >
            Limpar Storage Local e Recarregar
          </button>
        </div>
      </div>
    );
  }

  // Referencia versaoUi para re-renderizar quando o estado interno mudar
  void versaoUi;

  const usuarioLogado = sistema.auth.getUsuarioAtual();
  const bloqueadaInatividade = sistema.auth.isBloqueadaPorInatividade();
  const estadoMaquina = sistema.caixa.getEstadoMaquina();
  const subEstadoOffline = sistema.caixa.getSubEstadoOffline();
  const carrinho = sistema.getCarrinho();
  const produtos = sistema
    .listarProdutos()
    .filter((p) => categoriaFiltro === 'TODAS' || p.categoria === categoriaFiltro);
  const pedidosDelivery = sistema.pedidosRepo.listar();
  const filaReimpressao = sistema.getFilaReimpressao();
  const vendas = sistema.vendasRepo.listar();
  const eventosCompensatorios = sistema.vendasRepo.listarEventosCompensatorios();
  const outboxEventos = sistema.outboxRepo.listar(100);
  const outboxPendentes = sistema.outboxRepo.contarPendentes();
  const transacoesNuvem = sistema.nuvem.listarTransacoes();
  const auditLogs = sistema.auditRepo.listar(80);
  const ultimaImpressao = sistema.impressora.obterUltimaImpressao();
  const popupDelivery = sistema.getUltimoPedidoPopup();
  const statsSqlite = sistema.db.estatisticas();
  const statsNuvem = sistema.nuvem.estatisticas();

  // ───────────────────────── Handlers de Autenticação ─────────────────────────

  const handleLogin = (e: React.FormEvent): void => {
    e.preventDefault();
    setErroLogin(null);
    try {
      const user = sistema.login(loginInput, senhaInput);
      adicionarToast(
        'SUCESSO',
        `Bem-vindo, ${user.getNome()} (${user.getPapel()})`,
        `Autenticação offline concluída via cache cifrado em ${sistema.auth.getUltimoTempoAutenticacaoMs()}ms.`,
      );
      atualizarTela();
    } catch (err) {
      setErroLogin(err instanceof Error ? err.message : String(err));
      atualizarTela();
    }
  };

  const preencherCredencialRapida = (perfil: 'OPERADOR' | 'GERENTE'): void => {
    setErroLogin(null);
    if (perfil === 'OPERADOR') {
      setLoginInput(CREDENCIAIS_HOMOLOGACAO.operador.login);
      setSenhaInput(CREDENCIAIS_HOMOLOGACAO.operador.senhaPura);
    } else {
      setLoginInput(CREDENCIAIS_HOMOLOGACAO.gerente.login);
      setSenhaInput(CREDENCIAIS_HOMOLOGACAO.gerente.senhaPura);
    }
  };

  const handleSimularInatividade30Min = (): void => {
    relogioGlobal.avancar(31 * MINUTO_MS);
    sistema.auth.verificarInatividade();
    adicionarToast(
      'ALERTA',
      'Sessão Bloqueada por Inatividade (RNF05.3)',
      'Relógio avançado em +31 minutos. A sessão foi encerrada automaticamente.',
    );
    atualizarTela();
  };

  // ───────────────────────── Handlers do PDV e Produtos ─────────────────────────

  const handleAdicionarCarrinho = async (idProduto: number): Promise<void> => {
    try {
      await sistema.adicionarAoCarrinho(idProduto, 1);
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Erro no carrinho', err instanceof Error ? err.message : String(err));
    }
  };

  const handleAplicarDesconto = async (): Promise<void> => {
    try {
      const centavos = reaisParaCentavos(descontoInputReais || '0');
      await sistema.aplicarDescontoCarrinho(centavos);
      adicionarToast('INFO', 'Desconto Aplicado', `Desconto de ${formatarBRL(centavos)} gravado no WAL.`);
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Desconto Inválido', err instanceof Error ? err.message : String(err));
    }
  };

  const handleFinalizarVenda = async (): Promise<void> => {
    try {
      const res = await sistema.finalizarVendaCarrinho(metodoSelecionado);
      tocarAlertaSonoroDelivery('VENDA_OK');
      setDescontoInputReais('0,00');
      adicionarToast(
        'SUCESSO',
        `Venda #${res.venda.getNumeroSequencial()} Finalizada (${res.tempoProcessamentoMs}ms)`,
        res.sincronizadaImediatamente
          ? `Total ${formatarBRL(res.venda.getValorTotalCentavos())} sincronizado na nuvem e impresso na bobina 80mm.`
          : `Gravada localmente na Outbox (seq #${res.seqOutbox}) em modo Offline-First.`,
      );
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Não foi possível concluir a venda', err instanceof Error ? err.message : String(err));
    }
  };

  const abrirModalNovoProduto = (): void => {
    setProdutoEditando(null);
    setProdNome('');
    setProdDescricao('');
    setProdCategoria('MASSAS');
    setProdPrecoReais('52,90');
    setModalProdutoAberto(true);
  };

  const abrirModalEditarProduto = (p: Produto): void => {
    setProdutoEditando(p);
    setProdNome(p.nome);
    setProdDescricao(p.descricao);
    setProdCategoria(p.categoria);
    setProdPrecoReais((p.precoCentavos / 100).toFixed(2).replace('.', ','));
    setModalProdutoAberto(true);
  };

  const handleSalvarProduto = (e: React.FormEvent): void => {
    e.preventDefault();
    try {
      const precoCentavos = reaisParaCentavos(prodPrecoReais);
      if (produtoEditando) {
        sistema.atualizarProduto({
          ...produtoEditando,
          nome: prodNome,
          descricao: prodDescricao,
          categoria: prodCategoria,
          precoCentavos,
        });
        adicionarToast('SUCESSO', 'Produto Atualizado', `"${prodNome}" atualizado no catálogo SQLite.`);
      } else {
        const criado = sistema.cadastrarProduto({
          nome: prodNome,
          descricao: prodDescricao,
          categoria: prodCategoria,
          precoCentavos,
          ativo: true,
        });
        adicionarToast('SUCESSO', 'Produto Cadastrado', `"${criado.nome}" adicionado ao catálogo.`);
      }
      setModalProdutoAberto(false);
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Erro na validação do produto', err instanceof Error ? err.message : String(err));
    }
  };

  // ───────────────────────── Handlers de Delivery e Impressão ─────────────────────────

  const handleAceitarDelivery = (idInterno: string): void => {
    try {
      const res = sistema.aceitarPedidoDelivery(idInterno);
      if (res.impressoComSucesso) {
        tocarAlertaSonoroDelivery('VENDA_OK');
        adicionarToast(
          'SUCESSO',
          `Pedido #${res.pedido.getCodigoExterno()} em Preparo!`,
          `API parceira notificada e via impressa na cozinha em ${res.tempoImpressaoMs}ms.`,
        );
      } else {
        tocarAlertaSonoroDelivery('ERRO_IMPRESSORA');
        adicionarToast('ALERTA', 'Falha Física na Impressora (RN03)', res.alertaErroImpressao ?? 'Sem papel.');
      }
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Erro ao aceitar pedido', err instanceof Error ? err.message : String(err));
    }
  };

  const handleReimprimirDelivery = (idInterno: string): void => {
    try {
      const res = sistema.reimprimirViaCozinha(idInterno);
      if (res.impressoComSucesso) {
        tocarAlertaSonoroDelivery('VENDA_OK');
        adicionarToast(
          'SUCESSO',
          `Via Reimpressa (#${res.pedido.getCodigoExterno()})`,
          'Confirmação física recebida. Status atualizado para EM_PREPARO.',
        );
      } else {
        tocarAlertaSonoroDelivery('ERRO_IMPRESSORA');
        adicionarToast('ERRO', 'Impressora continua sem bobina', res.alertaErroImpressao ?? 'Sem papel.');
      }
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Erro na reimpressão', err instanceof Error ? err.message : String(err));
    }
  };

  const handleConfirmarRecusaDelivery = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!pedidoAlvoRecusa) return;
    try {
      const p = sistema.recusarPedidoDelivery(pedidoAlvoRecusa, motivoRecusaDelivery);
      adicionarToast('INFO', `Pedido #${p.getCodigoExterno()} Recusado`, `Motivo enviado à plataforma: ${motivoRecusaDelivery}`);
      setPedidoAlvoRecusa(null);
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Erro ao recusar pedido', err instanceof Error ? err.message : String(err));
    }
  };

  // ───────────────────────── Handlers de Estorno e Caixa ─────────────────────────

  const handleConfirmarEstorno = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!vendaAlvoEstorno) return;
    try {
      const credencial =
        usuarioLogado?.getPapel() === 'GERENTE'
          ? undefined
          : { login: loginGerenteModal, senhaPura: senhaGerenteModal };
      const ev = await sistema.autorizarEstornoVenda(vendaAlvoEstorno, motivoEstorno, credencial);
      adicionarToast(
        'SUCESSO',
        'Estorno Autorizado (RN02)',
        `Evento compensatório ${ev.idEvento.slice(0, 8)}… gerado por ${ev.autorizadoPor}. Venda original preservada.`,
      );
      setVendaAlvoEstorno(null);
      setMotivoEstorno('');
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Estorno Negado (RBAC / RN02)', err instanceof Error ? err.message : String(err));
    }
  };

  const handleAbrirCaixa = (): void => {
    try {
      const centavos = reaisParaCentavos(saldoAberturaReais);
      sistema.abrirCaixa(centavos);
      adicionarToast('SUCESSO', 'Caixa Aberto', `Fundo de troco inicial: ${formatarBRL(centavos)}.`);
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Erro ao abrir caixa', err instanceof Error ? err.message : String(err));
    }
  };

  const handleFecharCaixa = (): void => {
    try {
      const rel = sistema.fecharCaixa();
      setUltimoFechamento(rel);
      if (rel.alertaPendencia) {
        adicionarToast(
          'ALERTA',
          'Caixa Fechado com Ressalva (RN04)',
          `${rel.pendenciasOutbox} evento(s) não sincronizado(s) na Outbox foram preservados para o próximo ciclo online.`,
        );
      } else {
        adicionarToast('SUCESSO', 'Caixa Fechado', `Saldo final apurado: ${formatarBRL(rel.saldoFinalCentavos)}.`);
      }
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Erro ao fechar caixa', err instanceof Error ? err.message : String(err));
    }
  };

  // ───────────────────────── Handlers do Painel de Caos ─────────────────────────

  const handleToggleWan = async (): Promise<void> => {
    const novoOnline = !sistema.isRedeWanOnline();
    const rel = await sistema.definirConectividadeWan(novoOnline);
    if (!novoOnline) {
      adicionarToast(
        'ALERTA',
        'Queda de Rede WAN Simulada',
        'Máquina de estados comutou para OperandoOffline. Vendas serão gravadas na Outbox local.',
      );
    } else if (rel?.sucesso) {
      adicionarToast(
        'SUCESSO',
        'Rede Restaurada & Sincronizada',
        `${rel.eventosConfirmados} evento(s) sincronizado(s) com o PostgreSQL (${rel.duplicadosDescartadosNuvem} duplicatas descartadas).`,
      );
    } else {
      adicionarToast(
        'ERRO',
        'Falha na Sincronização em Lote (CT13)',
        `${rel?.erro ?? 'Erro de rede'} — Rollback integral executado no PostgreSQL e PDV retornado a OperandoOffline.`,
      );
    }
    atualizarTela();
  };

  const handleToggleBobina = (): void => {
    const novoEstado = !sistema.impressora.possuiPapel();
    sistema.impressora.definirBobinaPresente(novoEstado);
    adicionarToast(
      novoEstado ? 'SUCESSO' : 'ALERTA',
      novoEstado ? 'Bobina 80mm Reposta na Impressora' : 'Simulação: Impressora Sem Bobina (RN03)',
      novoEstado
        ? 'Porta 9100 pronta. Você já pode reimprimir as vias retidas em PENDENTE_IMPRESSAO.'
        : 'Próximos aceites detectarão falta de papel em 180ms (<= 3s) e reterão o status em PENDENTE_IMPRESSAO.',
    );
    atualizarTela();
  };

  const handleToggleToxiproxy = (): void => {
    const novo = !sistema.nuvem.isCorteMeioDoLoteAtivo();
    sistema.nuvem.definirCorteMeioDoLote(novo);
    adicionarToast(
      novo ? 'ALERTA' : 'INFO',
      novo ? 'Toxiproxy Ativo: Corte no Meio do Lote (CT13)' : 'Servidor PostgreSQL Saudável',
      novo
        ? 'A próxima sincronização sofrerá queda TCP na metade do lote, provando o rollback atômico remoto.'
        : 'Recebimento de lotes normalizado na nuvem.',
    );
    atualizarTela();
  };

  const handleInjetarPedido = (plataforma: 'IFOOD' | 'AIQFOME', duplicado = false): void => {
    try {
      const res = sistema.injetarPedidoSimulado(plataforma, duplicado);
      if (res.status === 'ACEITO_FILA' && res.pedido) {
        tocarAlertaSonoroDelivery('NOVO_PEDIDO');
        adicionarToast(
          'INFO',
          `Novo Pedido ${plataforma} #${res.pedido.getCodigoExterno()}`,
          `Cliente: ${res.pedido.getClienteNome()} — ${formatarBRL(res.pedido.getValorTotalCentavos())}`,
        );
      } else if (res.status === 'DUPLICATA_DESCARTADA') {
        adicionarToast(
          'ALERTA',
          'Idempotência: Pedido Duplicado Descartado (CT06)',
          `O codigoExterno repetido da plataforma ${plataforma} foi ignorado sem duplicar na fila.`,
        );
      }
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Falha na recepção do pedido', err instanceof Error ? err.message : String(err));
    }
  };

  const handleSimularQuedaEletrica = async (): Promise<void> => {
    await sistema.db.persistir();
    window.location.reload();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TELA DE LOGIN (QUANDO DESLOGADO OU BLOQUEADO POR INATIVIDADE)
  // ═══════════════════════════════════════════════════════════════════════════

  if (!usuarioLogado) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6">
        <div className="max-w-md w-full mx-auto my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="inline-block text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                UNIFEI · ECOT11A · MVP
              </span>
              <h1 className="text-2xl font-extrabold text-white mt-2">Restaurante Basílico</h1>
              <p className="text-xs text-slate-400">PDV Híbrido Offline-First &amp; Hub Central de Delivery</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 font-black text-xl">
              B
            </div>
          </div>

          {bloqueadaInatividade && (
            <div className="mb-4 p-3 rounded-lg bg-amber-950/80 border border-amber-500/60 text-amber-200 text-xs">
              <strong>Sessão bloqueada por inatividade (RNF05.3 / CT04):</strong> Mais de 30 minutos sem interação.
              Autentique-se novamente para retomar o turno (seu carrinho WAL permanece salvo).
            </div>
          )}

          {erroLogin && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-lg bg-red-950/90 border border-red-500 text-red-200 text-xs font-medium"
            >
              {erroLogin}
            </div>
          )}

          {/* Botões de preenchimento rápido de 1 clique para o Professor Avaliador */}
          <div className="mb-5 p-3.5 rounded-xl bg-slate-950/90 border border-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-2">
              Acesso Rápido para Homologação (1 Clique)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => preencherCredencialRapida('OPERADOR')}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 transition cursor-pointer"
              >
                Preencher Operador
              </button>
              <button
                type="button"
                onClick={() => preencherCredencialRapida('GERENTE')}
                className="px-3 py-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900/80 border border-emerald-500/40 text-xs font-semibold text-emerald-200 transition cursor-pointer"
              >
                Preencher Gerente
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Usuário ou E-mail
              </label>
              <input
                type="text"
                value={loginInput}
                onChange={(e) => setLoginInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-400"
                placeholder="operador ou gerente"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Senha (bcrypt cost 12 · Cache Cifrado Offline)
              </label>
              <input
                type="password"
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-400"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              Autenticar no PDV
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Carrinho salvo no WAL (RPO=0):</span>
              <span className="font-mono text-emerald-300">
                {carrinho.getQuantidadeItens()} item(ns) · {formatarBRL(carrinho.getTotalCentavos())}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Cifragem Local:</span>
              <span className="font-mono text-slate-300">AES-256-GCM (PBKDF2 120k)</span>
            </div>
          </div>
        </div>

        <footer className="text-center text-xs text-slate-500">
          Universidade Federal de Itajubá (UNIFEI) · ECOT11A / ECOT01 · Autor: Matheus Gouveia Purcino (2024006907)
        </footer>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTERFACE OPERACIONAL PRINCIPAL
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-44">
      {/* Toasts Flutuantes */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl backdrop-blur-md text-xs ${
              t.tipo === 'SUCESSO'
                ? 'bg-emerald-950/95 border-emerald-500 text-emerald-100'
                : t.tipo === 'ALERTA'
                  ? 'bg-amber-950/95 border-amber-500 text-amber-100'
                  : t.tipo === 'ERRO'
                    ? 'bg-red-950/95 border-red-500 text-red-100'
                    : 'bg-slate-900/95 border-sky-500 text-sky-100'
            }`}
          >
            <div className="font-bold text-sm">{t.titulo}</div>
            <div className="mt-0.5 opacity-90">{t.mensagem}</div>
          </div>
        ))}
      </div>

      {/* Pop-up de Alto Contraste ao chegar Novo Pedido de Delivery (RNF03.4) */}
      {popupDelivery && (
        <div className="bg-emerald-500 text-slate-950 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-lg border-b-2 border-emerald-300">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-slate-950 text-emerald-400 font-black text-xs uppercase">
              NOVO PEDIDO {popupDelivery.getPlataforma()} #{popupDelivery.getCodigoExterno()}
            </span>
            <span className="font-bold text-sm">
              {popupDelivery.getClienteNome()} — {formatarBRL(popupDelivery.getValorTotalCentavos())} (
              {popupDelivery.getItens().length} item(ns))
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAbaAtiva('DELIVERY');
                handleAceitarDelivery(popupDelivery.getIdInterno());
              }}
              className="px-3.5 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-emerald-300 font-bold text-xs cursor-pointer"
            >
              Aceitar e Imprimir Agora (RF04)
            </button>
            <button
              onClick={() => {
                sistema.dispensarPopupDelivery();
                atualizarTela();
              }}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/40 hover:bg-emerald-600/60 text-slate-950 font-semibold text-xs cursor-pointer"
            >
              Ocultar Aviso
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────────── HEADER OPERACIONAL ───────────────────────── */}
      <header className="bg-slate-900/95 border-b border-slate-800 px-6 py-3.5 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 font-black text-lg">
              B
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight text-white">
                  Restaurante Basílico
                </h1>
                <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  Pouso Alegre/MG
                </span>
              </div>
              <p className="text-xs text-slate-400">
                PDV Offline-First &amp; Hub de Delivery · UNIFEI ECOT11A
              </p>
            </div>
          </div>

          {/* Indicador Luminoso da Máquina de Estados (Figura 4 / RNF01.4) */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border text-xs font-bold ${
                estadoMaquina === 'OperandoOnline'
                  ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
                  : estadoMaquina === 'Sincronizando'
                    ? 'bg-amber-950/90 border-amber-400 text-amber-200 animate-pulse'
                    : 'bg-red-950/90 border-red-500 text-red-200'
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  estadoMaquina === 'OperandoOnline'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : estadoMaquina === 'Sincronizando'
                      ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                      : 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                }`}
              />
              <span>
                Estado: {estadoMaquina}
                {subEstadoOffline ? ` · ${subEstadoOffline}` : ''}
              </span>
              {outboxPendentes > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-black/40 font-mono text-[11px]">
                  Outbox: {outboxPendentes}
                </span>
              )}
            </div>

            {/* Status do Caixa + Saldo Local */}
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                  sistema.caixa.isAberto()
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40'
                }`}
              >
                CAIXA {sistema.caixa.isAberto() ? 'ABERTO' : 'FECHADO'}
              </span>
              <span className="text-slate-400">Saldo Local:</span>
              <span className="font-mono font-bold text-emerald-300">
                {formatarBRL(sistema.caixa.getSaldoLocalCentavos())}
              </span>
            </div>

            {/* Perfil Logado + Simulador de Inatividade 30min + Trocar Usuário */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
              <span className="text-slate-300 font-semibold">{usuarioLogado.getNome()}</span>
              <span
                className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                  usuarioLogado.getPapel() === 'GERENTE'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                }`}
              >
                {usuarioLogado.getPapel()}
              </span>
              <button
                onClick={handleSimularInatividade30Min}
                title="Avança o relógio injetável em 31 minutos para testar o bloqueio automático RNF05.3 / CT04"
                className="ml-1 px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold text-[11px] cursor-pointer"
              >
                ⏱ Simular 30min Inativo
              </button>
              <button
                onClick={() => {
                  sistema.logout();
                  atualizarTela();
                }}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] cursor-pointer"
              >
                Sair
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Abas Principais */}
        <div className="max-w-[1600px] mx-auto mt-3 flex flex-wrap gap-2">
          {(
            [
              { id: 'PDV', rotulo: '1. Frente de Caixa (PDV Offline-First)', badge: `${carrinho.getQuantidadeItens()} no carrinho` },
              {
                id: 'DELIVERY',
                rotulo: '2. Hub Central de Delivery (iFood & Aiqfome)',
                badge: `${pedidosDelivery.filter((p) => p.getStatus() === 'RECEBIDO' || p.getStatus() === 'PENDENTE_IMPRESSAO').length} ativo(s)`,
              },
              {
                id: 'VENDAS_CAIXA',
                rotulo: '3. Histórico de Vendas, Estornos (RBAC) & Caixa',
                badge: `${vendas.length} venda(s)`,
              },
              {
                id: 'INSPETOR',
                rotulo: '4. Inspetor Arquitetural (Outbox SQLite ↔ PostgreSQL, Logs & LGPD)',
                badge: `${outboxPendentes} pendente(s)`,
              },
            ] as const
          ).map((aba) => (
            <button
              key={aba.id}
              onClick={() => setAbaAtiva(aba.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                abaAtiva === aba.id
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
              }`}
            >
              <span>{aba.rotulo}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  abaAtiva === aba.id ? 'bg-slate-950 text-emerald-300' : 'bg-slate-800 text-slate-300'
                }`}
              >
                {aba.badge}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* ───────────────────────── CORPO PRINCIPAL + BOBINA 80MM LATERAL ───────────────────────── */}
      <main className="max-w-[1600px] w-full mx-auto px-6 py-5 grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1">
        {/* Área das Abas (8 colunas no desktop) */}
        <section className="xl:col-span-8 space-y-5">
          {/* ═══════════════════ ABA 1: FRENTE DE CAIXA (PDV) ═══════════════════ */}
          {abaAtiva === 'PDV' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Catálogo de Produtos (7 col) */}
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-sm font-bold text-white">Catálogo Gastronômico Basílico</h2>
                    <p className="text-xs text-slate-400">
                      Valores calculados em centavos inteiros (RF01 / CT01)
                    </p>
                  </div>
                  <button
                    onClick={abrirModalNovoProduto}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer"
                  >
                    + Novo Produto (CRUD)
                  </button>
                </div>

                {/* Filtro por Categoria */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <button
                    onClick={() => setCategoriaFiltro('TODAS')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                      categoriaFiltro === 'TODAS'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-950 text-slate-300 border border-slate-800'
                    }`}
                  >
                    Todas
                  </button>
                  {CATEGORIAS_PRODUTO.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoriaFiltro(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                        categoriaFiltro === cat
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Grid de Pratos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
                  {produtos.map((p) => (
                    <div
                      key={p.id}
                      className="bg-slate-950 border border-slate-800 hover:border-emerald-500/50 rounded-xl p-3.5 flex flex-col justify-between transition"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-emerald-300">
                            {p.categoria}
                          </span>
                          <button
                            onClick={() => abrirModalEditarProduto(p)}
                            className="text-[11px] text-slate-400 hover:text-emerald-300 underline cursor-pointer"
                          >
                            Editar
                          </button>
                        </div>
                        <h3 className="text-sm font-bold text-white mt-1.5">{p.nome}</h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{p.descricao}</p>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="font-mono font-extrabold text-sm text-emerald-300">
                          {formatarBRL(p.precoCentavos)}
                        </span>
                        <button
                          onClick={() => void handleAdicionarCarrinho(p.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                        >
                          + Adicionar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Carrinho Persistente WAL (5 col) */}
              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                    <div>
                      <h2 className="text-sm font-bold text-white">Carrinho Persistente (WAL)</h2>
                      <p className="text-[11px] text-emerald-400">
                        RPO = 0 · Sobrevive a queda elétrica / F5 (CT12)
                      </p>
                    </div>
                    {!carrinho.estaVazio() && (
                      <button
                        onClick={() => void sistema.limparCarrinho().then(atualizarTela)}
                        className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer"
                      >
                        Limpar
                      </button>
                    )}
                  </div>

                  {carrinho.estaVazio() ? (
                    <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                      Selecione pratos ou bebidas ao lado para iniciar a venda.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {carrinho.getItens().map((item) => (
                        <div
                          key={item.getIdProduto()}
                          className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-white truncate">{item.getNomeProduto()}</div>
                            <div className="text-slate-400 font-mono">
                              {item.getQuantidade()} x {formatarBRL(item.getPrecoUnitarioCentavos())}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() =>
                                void sistema
                                  .alterarQuantidadeCarrinho(item.getIdProduto(), item.getQuantidade() - 1)
                                  .then(atualizarTela)
                              }
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-mono font-bold">{item.getQuantidade()}</span>
                            <button
                              onClick={() =>
                                void sistema
                                  .alterarQuantidadeCarrinho(item.getIdProduto(), item.getQuantidade() + 1)
                                  .then(atualizarTela)
                              }
                              className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 font-bold cursor-pointer"
                            >
                              +
                            </button>
                            <span className="w-20 text-right font-mono font-bold text-emerald-300">
                              {formatarBRL(item.getSubtotalCentavos())}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fechamento da Venda */}
                <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-300 font-semibold whitespace-nowrap">
                      Desconto (R$):
                    </label>
                    <input
                      type="text"
                      value={descontoInputReais}
                      onChange={(e) => setDescontoInputReais(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white"
                      placeholder="0,00"
                    />
                    <button
                      type="button"
                      onClick={() => void handleAplicarDesconto()}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-300 cursor-pointer"
                    >
                      Aplicar
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-300 font-semibold mb-1.5">
                      Método de Pagamento:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {METODOS_PAGAMENTO.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMetodoSelecionado(m)}
                          className={`py-2 rounded-lg text-xs font-bold border transition cursor-pointer ${
                            metodoSelecionado === m
                              ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal ({carrinho.getQuantidadeItens()} itens):</span>
                      <span className="font-mono">{formatarBRL(carrinho.getSubtotalCentavos())}</span>
                    </div>
                    <div className="flex justify-between text-amber-300">
                      <span>Desconto:</span>
                      <span className="font-mono">-{formatarBRL(carrinho.getDescontoCentavos())}</span>
                    </div>
                    <div className="flex justify-between text-base font-extrabold text-emerald-300 pt-1 border-t border-slate-800">
                      <span>TOTAL A PAGAR:</span>
                      <span className="font-mono">{formatarBRL(carrinho.getTotalCentavos())}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={carrinho.estaVazio() || !sistema.caixa.isAberto()}
                    onClick={() => void handleFinalizarVenda()}
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-sm shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                  >
                    {sistema.caixa.isAberto()
                      ? `Finalizar Venda (${metodoSelecionado}) & Imprimir Cupom`
                      : 'Caixa Fechado — Abra o Caixa na Aba 3'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════ ABA 2: HUB CENTRAL DE DELIVERY ═══════════════════ */}
          {abaAtiva === 'DELIVERY' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Hub Central de Delivery — iFood &amp; Aiqfome (RF03 / RF04 / RN03)
                  </h2>
                  <p className="text-xs text-slate-400">
                    O pedido só assume <code className="text-emerald-300">EM_PREPARO</code> após confirmação física da
                    impressora térmica 80mm. Sem bobina → retido em{' '}
                    <code className="text-amber-300">PENDENTE_IMPRESSAO</code>.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                    TLS: <strong className="text-emerald-400">{sistema.ifoodAdapter.getVersaoTls()}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono">
                    OAuth Renovações: <strong>{sistema.ifoodAdapter.getTokenOAuth().renovacoes}</strong>
                  </span>
                </div>
              </div>

              {filaReimpressao.length > 0 && (
                <div className="p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/70 text-amber-100 text-xs flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <strong className="text-amber-300">
                      RN03 — Fila de Reimpressão Ativa ({filaReimpressao.length} pedido(s) retido(s)):
                    </strong>{' '}
                    Verifique se a bobina de 80mm está carregada no Painel de Caos abaixo e clique em{' '}
                    <strong>Reimprimir Via na Cozinha</strong>.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pedidosDelivery.map((ped) => {
                  const status = ped.getStatus();
                  return (
                    <div
                      key={ped.getIdInterno()}
                      className={`bg-slate-950 border rounded-xl p-4 flex flex-col justify-between ${
                        status === 'PENDENTE_IMPRESSAO'
                          ? 'border-amber-500'
                          : status === 'RECEBIDO'
                            ? 'border-emerald-500/60'
                            : 'border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded font-black text-[11px] ${
                              ped.getPlataforma() === 'IFOOD'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                                : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                            }`}
                          >
                            {ped.getPlataforma()} #{ped.getCodigoExterno()}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              status === 'RECEBIDO'
                                ? 'bg-sky-500/20 text-sky-300'
                                : status === 'PENDENTE_IMPRESSAO'
                                  ? 'bg-amber-500/25 text-amber-200 animate-pulse'
                                  : status === 'EM_PREPARO'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : status === 'CONCLUIDO'
                                      ? 'bg-slate-800 text-slate-300'
                                      : 'bg-red-950 text-red-300'
                            }`}
                          >
                            {status}
                          </span>
                        </div>

                        <div className="mt-2.5 text-xs space-y-0.5">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{ped.getClienteNome()}</span>
                            {ped.isAnonimizadoLgpd() && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-950 border border-purple-500/50 text-[10px] text-purple-200">
                                LGPD RE01
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400">{ped.getClienteTelefone()}</div>
                          <div className="text-slate-400 truncate">{ped.getClienteEndereco()}</div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800/80 space-y-1 text-xs">
                          {ped.getItens().map((i, idx) => (
                            <div key={idx} className="flex justify-between text-slate-300">
                              <span>
                                {i.getQuantidade()}x {i.getNomeProduto()}
                              </span>
                              <span className="font-mono">{formatarBRL(i.getSubtotalCentavos())}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono font-extrabold text-sm text-emerald-300">
                          {formatarBRL(ped.getValorTotalCentavos())}
                        </span>

                        <div className="flex flex-wrap gap-1.5">
                          {status === 'RECEBIDO' && (
                            <>
                              <button
                                onClick={() => handleAceitarDelivery(ped.getIdInterno())}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                              >
                                Aceitar &amp; Imprimir na Cozinha
                              </button>
                              <button
                                onClick={() => setPedidoAlvoRecusa(ped.getIdInterno())}
                                className="px-2.5 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 border border-red-500/50 text-red-200 font-semibold text-xs cursor-pointer"
                              >
                                Recusar
                              </button>
                            </>
                          )}

                          {status === 'PENDENTE_IMPRESSAO' && (
                            <button
                              onClick={() => handleReimprimirDelivery(ped.getIdInterno())}
                              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer"
                            >
                              🖨 Reimprimir Via na Cozinha (RN03)
                            </button>
                          )}

                          {status === 'EM_PREPARO' && (
                            <button
                              onClick={() => {
                                sistema.concluirPedidoDelivery(ped.getIdInterno());
                                adicionarToast('SUCESSO', 'Pedido Concluído', `Pedido #${ped.getCodigoExterno()} entregue.`);
                                atualizarTela();
                              }}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs cursor-pointer"
                            >
                              Marcar Concluído
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══════════════════ ABA 3: HISTÓRICO DE VENDAS, ESTORNOS (RBAC) & CAIXA ═══════════════════ */}
          {abaAtiva === 'VENDAS_CAIXA' && (
            <div className="space-y-5">
              {/* Controle de Turno do Caixa (RN04) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Gestão de Turno do Caixa (RN04)</h2>
                    <p className="text-xs text-slate-400">
                      Se o caixa for fechado offline com itens pendentes na Outbox, o sistema emite alerta de pendência
                      e preserva a fila para o próximo ciclo online (CT11).
                    </p>
                  </div>

                  {sistema.caixa.isAberto() ? (
                    <button
                      onClick={handleFecharCaixa}
                      className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs cursor-pointer"
                    >
                      Fechar Caixa Agora ({outboxPendentes} pendente(s) na Outbox)
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={saldoAberturaReais}
                        onChange={(e) => setSaldoAberturaReais(e.target.value)}
                        className="w-28 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono"
                        placeholder="250,00"
                      />
                      <button
                        onClick={handleAbrirCaixa}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs cursor-pointer"
                      >
                        Abrir Caixa (R$)
                      </button>
                    </div>
                  )}
                </div>

                {ultimoFechamento && (
                  <div
                    className={`mt-4 p-4 rounded-xl border text-xs ${
                      ultimoFechamento.alertaPendencia
                        ? 'bg-amber-950/70 border-amber-500 text-amber-100'
                        : 'bg-slate-950 border-slate-800 text-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap justify-between gap-2 font-bold text-sm mb-2">
                      <span>
                        Relatório de Fechamento #{ultimoFechamento.idFechamento.slice(0, 8)} ({ultimoFechamento.modo})
                      </span>
                      <span className="font-mono text-emerald-300">
                        Saldo Final: {formatarBRL(ultimoFechamento.saldoFinalCentavos)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300">
                      <div>Vendas Brutas: {formatarBRL(ultimoFechamento.totalVendasBrutoCentavos)}</div>
                      <div>Estornos: {formatarBRL(ultimoFechamento.totalEstornosCentavos)}</div>
                      <div>Qtd. Vendas: {ultimoFechamento.quantidadeVendas}</div>
                      <div>Pendências Outbox: {ultimoFechamento.pendenciasOutbox}</div>
                    </div>
                    {ultimoFechamento.ressalvas.length > 0 && (
                      <ul className="mt-2 pt-2 border-t border-amber-500/40 list-disc list-inside text-amber-200 space-y-1">
                        {ultimoFechamento.ressalvas.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Lista de Vendas Presenciais & Estorno RBAC (RN02) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-1">
                  Vendas Presenciais Registradas &amp; Estorno Exclusivo de Gerente (RN02 / CT02)
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  O estorno exige credencial de <code className="text-purple-300">GERENTE</code>, nunca apaga a venda
                  original e gera um <code className="text-emerald-300">EventoCompensatorio</code> imutável.
                </p>

                {vendas.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-800 rounded-xl">
                    Nenhuma venda presencial registrada ainda. Finalize uma venda na Aba 1.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {vendas.map((v) => (
                      <div
                        key={v.getIdVenda()}
                        className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white">
                              Venda #{String(v.getNumeroSequencial()).padStart(4, '0')}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-800 font-mono text-[11px]">
                              {v.getMetodoPagamento()}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                v.isSincronizado()
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}
                            >
                              {v.isSincronizado() ? 'SINCRONIZADA NUVEM' : 'FILA LOCAL (OUTBOX)'}
                            </span>
                            {v.isEstornada() && (
                              <span className="px-2 py-0.5 rounded bg-red-500/25 border border-red-500/50 text-red-200 font-bold text-[10px]">
                                ESTORNADA (RN02)
                              </span>
                            )}
                          </div>
                          <div className="text-slate-400 mt-1 font-mono text-[11px]">
                            UUID: {v.getIdVenda()} · {new Date(v.getDataHora()).toLocaleTimeString('pt-BR')}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-mono font-extrabold text-sm text-emerald-300">
                            {formatarBRL(v.getValorTotalCentavos())}
                          </span>
                          {!v.isEstornada() && (
                            <button
                              onClick={() => {
                                setVendaAlvoEstorno(v.getIdVenda());
                                setMotivoEstorno('Solicitação do cliente / erro de lançamento');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 border border-red-500/50 text-red-200 font-bold text-xs cursor-pointer"
                            >
                              Solicitar Estorno (RN02)
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {eventosCompensatorios.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-slate-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 mb-2">
                      Eventos Compensatórios Gerados (RN02)
                    </h4>
                    <div className="space-y-2">
                      {eventosCompensatorios.map((ev) => (
                        <div
                          key={ev.idEvento}
                          className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/40 text-xs flex flex-wrap justify-between gap-2"
                        >
                          <div>
                            <span className="font-mono font-bold text-purple-200">
                              Evento {ev.idEvento.slice(0, 8)}…
                            </span>{' '}
                            → Venda #{ev.numeroVendaOriginal} ({ev.idVendaOriginal.slice(0, 8)}…) · Motivo:{' '}
                            <em>&ldquo;{ev.motivo}&rdquo;</em>
                          </div>
                          <div className="font-mono text-purple-200">
                            -{formatarBRL(ev.valorEstornadoCentavos)} (Autorizado por: {ev.autorizadoPor})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════ ABA 4: INSPETOR ARQUITETURAL ═══════════════════ */}
          {abaAtiva === 'INSPETOR' && (
            <div className="space-y-5">
              {/* Visão Lado a Lado: Outbox SQLite <-> PostgreSQL Cloud */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Coluna SQLite Local */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-emerald-300">
                      SQLite Local · <code className="font-mono">outbox_events</code>
                    </h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300">
                      WAL Seq #{statsSqlite.ultimoSeq}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2 font-mono break-all">
                    Amostra AES-256-GCM: {statsSqlite.amostraCifradaHex || 'aguardando checkpoint'}
                  </p>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {outboxEventos.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">Nenhum evento na Outbox local.</p>
                    ) : (
                      outboxEventos.map((ev) => (
                        <div
                          key={ev.idEvento}
                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-white truncate">
                              #{ev.seq} · {ev.tipo}
                            </div>
                            <div className="font-mono text-slate-400 truncate">UUID: {ev.idEvento}</div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                              ev.status === 'SINCRONIZADO'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : ev.status === 'DEAD_LETTER'
                                  ? 'bg-red-500/20 text-red-300'
                                  : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {ev.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Coluna PostgreSQL Remoto */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-sky-300">
                      PostgreSQL Nuvem · <code className="font-mono">cloud_transactions</code>
                    </h3>
                    <button
                      onClick={() =>
                        void sistema.syncWorker.reenviarUltimoLoteConfirmado().then((r) => {
                          adicionarToast(
                            'INFO',
                            'Teste de Idempotência UUID v4 (RNF02.2 / CT08)',
                            `Reenviados: ${r.enviados} | Inseridos: ${r.inseridos} | Duplicados descartados: ${r.duplicadosDescartados}`,
                          );
                          atualizarTela();
                        })
                      }
                      className="px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 text-[11px] font-semibold cursor-pointer"
                    >
                      Reenviar Último Lote (Idempotência)
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2 font-mono">
                    Total: {statsNuvem.totalTransacoes} · Rollbacks Atômicos: {statsNuvem.rollbacksRealizados} ·
                    Duplicatas Descartadas: {statsNuvem.duplicatasDescartadasTotal}
                  </p>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {transacoesNuvem.length === 0 ? (
                      <p className="text-xs text-slate-500 py-6 text-center">
                        Nenhuma transação sincronizada na nuvem ainda.
                      </p>
                    ) : (
                      transacoesNuvem.map((t) => (
                        <div
                          key={t.idEvento}
                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="font-mono font-bold text-sky-200 truncate">
                              Seq Origem #{t.seqOrigem} · {t.tipo}
                            </div>
                            <div className="font-mono text-slate-400 truncate">UUID: {t.idEvento}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono text-[10px]">
                            COMMITTED
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Rotina LGPD (RE01 / CT05) + Audit Logs Imutáveis */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Governança LGPD (RE01 / CT05) &amp; <code className="font-mono">audit_logs</code> Imutáveis
                    </h3>
                    <p className="text-xs text-slate-400">
                      Mascara nome, telefone e endereço de pedidos vencidos (&gt; 180 dias) preservando os totais
                      fiscais.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const rel = sistema.executarRotinaAnonimizacaoLgpd(180);
                      adicionarToast(
                        'SUCESSO',
                        'Rotina LGPD (RE01) Executada',
                        `Avaliados: ${rel.avaliados} | Anonimizados: ${rel.anonimizados} | Vigentes preservados: ${rel.preservadosPrazoVigente}.`,
                      );
                      atualizarTela();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-extrabold text-xs cursor-pointer"
                  >
                    🔒 Executar Anonimização LGPD (RE01)
                  </button>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="text-emerald-400 font-bold">[{log.categoria}]</span>{' '}
                        <span className="text-white font-semibold">{log.acao}</span> —{' '}
                        <span className="text-slate-300">{log.detalhes}</span>
                      </div>
                      <div className="text-slate-500">
                        {log.usuario} · {new Date(log.dataHora).toLocaleTimeString('pt-BR')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ───────────────────────── COLUNA DIREITA: BOBINA TÉRMICA ESC/POS 80MM ───────────────────────── */}
        <aside className="xl:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-white">Impressora Térmica ESC/POS (80mm)</h2>
                <p className="text-[11px] text-slate-400">{sistema.impressora.descricao}</p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                  sistema.impressora.possuiPapel()
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-red-500/25 text-red-200 border border-red-500 animate-pulse'
                }`}
              >
                {sistema.impressora.possuiPapel() ? 'BOBINA 80MM OK' : 'SEM PAPEL (ERRO 0x72)'}
              </span>
            </div>

            {/* Papel Térmico 80mm */}
            <div className="thermal-paper rounded-xl p-4 text-xs leading-relaxed overflow-x-auto">
              {ultimaImpressao ? (
                <>
                  <div className="flex justify-between text-[10px] text-stone-600 border-b border-stone-400/60 pb-1 mb-2">
                    <span>
                      JOB #{ultimaImpressao.idJob} · {ultimaImpressao.tipo}
                    </span>
                    <span>
                      {ultimaImpressao.tempoMs}ms · {ultimaImpressao.bytesEscPos.byteLength} bytes
                    </span>
                  </div>
                  <pre className="text-[11px] leading-snug whitespace-pre font-mono">
                    {ultimaImpressao.linhasRenderizadas.join('\n')}
                  </pre>
                </>
              ) : (
                <div className="py-10 text-center text-stone-600 text-xs">
                  Finalize uma venda presencial ou aceite um pedido de delivery para emitir o comprovante ESC/POS aqui.
                </div>
              )}
            </div>

            {/* Hex Dump dos Bytes ESC/POS */}
            {ultimaImpressao && (
              <div className="mt-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
                  Stream Binário ESC/POS (0x1B 0x40 Init … 0x1D 0x56 Cut)
                </div>
                <div className="font-mono text-[10px] text-slate-400 break-all">{ultimaImpressao.hexDump}</div>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* ───────────────────────── PAINEL FIXO: LABORATÓRIO DE CAOS & SIMULAÇÃO (ECOT11A) ───────────────────────── */}
      <section className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 border-t-2 border-emerald-500/60 backdrop-blur-md px-6 py-3 shadow-2xl">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 rounded bg-emerald-500 text-slate-950 font-black text-[11px] uppercase">
              Laboratório de Caos &amp; Simulação (ECOT11A)
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Injete falhas de rede, falta de bobina e corte de lote em tempo real:
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Toggle Rede WAN */}
            <button
              onClick={() => void handleToggleWan()}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                sistema.isRedeWanOnline()
                  ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900'
                  : 'bg-red-950 border-red-500 text-red-200 hover:bg-red-900'
              }`}
            >
              🌐 Rede WAN: {sistema.isRedeWanOnline() ? 'Online' : 'Offline (Queda de Internet)'}
            </button>

            {/* 2. Toggle Impressora Térmica 9100 */}
            <button
              onClick={handleToggleBobina}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                sistema.impressora.possuiPapel()
                  ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300 hover:bg-emerald-900'
                  : 'bg-amber-950 border-amber-500 text-amber-200 hover:bg-amber-900'
              }`}
            >
              🖨 Impressora 9100:{' '}
              {sistema.impressora.possuiPapel() ? 'Com Bobina (OK)' : 'Sem Bobina de Papel (Erro ESC/POS)'}
            </button>

            {/* 3. Toggle Falha Toxiproxy */}
            <button
              onClick={handleToggleToxiproxy}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                !sistema.nuvem.isCorteMeioDoLoteAtivo()
                  ? 'bg-slate-950 border-slate-700 text-slate-200 hover:bg-slate-800'
                  : 'bg-red-950 border-red-500 text-red-200 hover:bg-red-900'
              }`}
            >
              ☁️ Nuvem:{' '}
              {!sistema.nuvem.isCorteMeioDoLoteAtivo()
                ? 'Servidor Saudável'
                : 'Cortar Rede no Meio do Lote (Rollback CT13)'}
            </button>

            {/* 4. Botões de Injeção */}
            <button
              onClick={() => handleInjetarPedido('IFOOD', false)}
              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-200 text-xs font-bold cursor-pointer"
            >
              + Receber Pedido iFood
            </button>

            <button
              onClick={() => handleInjetarPedido('AIQFOME', false)}
              className="px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-200 text-xs font-bold cursor-pointer"
            >
              + Receber Pedido Aiqfome
            </button>

            <button
              onClick={() => handleInjetarPedido('IFOOD', true)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
            >
              + Injetar Pedido Duplicado (Idempotência)
            </button>

            <button
              onClick={() => void handleSimularQuedaEletrica()}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-xs font-bold cursor-pointer"
            >
              ⚡ Simular Queda Elétrica (Reload RPO=0)
            </button>
          </div>
        </div>
      </section>

      {/* ───────────────────────── MODAL: CRUD DE PRODUTO ───────────────────────── */}
      {modalProdutoAberto && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-white mb-4">
              {produtoEditando ? `Editar Produto #${produtoEditando.id}` : 'Novo Produto no Catálogo'}
            </h3>
            <form onSubmit={handleSalvarProduto} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Nome do Prato / Bebida</label>
                <input
                  type="text"
                  value={prodNome}
                  onChange={(e) => setProdNome(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Descrição</label>
                <textarea
                  value={prodDescricao}
                  onChange={(e) => setProdDescricao(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Categoria</label>
                  <select
                    value={prodCategoria}
                    onChange={(e) => setProdCategoria(e.target.value as CategoriaProduto)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  >
                    {CATEGORIAS_PRODUTO.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Preço (R$)</label>
                  <input
                    type="text"
                    value={prodPrecoReais}
                    onChange={(e) => setProdPrecoReais(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalProdutoAberto(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 text-slate-950 font-bold cursor-pointer"
                >
                  Salvar Produto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────── MODAL: AUTORIZAR ESTORNO RBAC (RN02) ───────────────────────── */}
      {vendaAlvoEstorno && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/60 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-white">Autorização de Estorno (RN02 / RBAC)</h3>
            <p className="text-xs text-slate-400 mt-1 mb-4">
              A venda original não será apagada. Um <code className="text-emerald-300">EventoCompensatorio</code> e um
              registro em <code className="text-emerald-300">audit_logs</code> imutável serão gravados.
            </p>
            <form onSubmit={(e) => void handleConfirmarEstorno(e)} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Motivo do Estorno (mínimo 5 caracteres)
                </label>
                <input
                  type="text"
                  value={motivoEstorno}
                  onChange={(e) => setMotivoEstorno(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  required
                />
              </div>

              {usuarioLogado.getPapel() !== 'GERENTE' && (
                <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/50 space-y-2">
                  <div className="text-[11px] font-bold text-purple-300">
                    Você está logado como OPERADOR. Informe a credencial do GERENTE:
                  </div>
                  <input
                    type="text"
                    value={loginGerenteModal}
                    onChange={(e) => setLoginGerenteModal(e.target.value)}
                    placeholder="Login do Gerente"
                    className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                  />
                  <input
                    type="password"
                    value={senhaGerenteModal}
                    onChange={(e) => setSenhaGerenteModal(e.target.value)}
                    placeholder="Senha do Gerente"
                    className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setVendaAlvoEstorno(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-400 text-slate-950 font-extrabold cursor-pointer"
                >
                  Confirmar Estorno (Gerente)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────── MODAL: RECUSAR PEDIDO DELIVERY ───────────────────────── */}
      {pedidoAlvoRecusa && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-white mb-3">Recusar Pedido de Delivery</h3>
            <form onSubmit={handleConfirmarRecusaDelivery} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Motivo da Recusa</label>
                <input
                  type="text"
                  value={motivoRecusaDelivery}
                  onChange={(e) => setMotivoRecusaDelivery(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPedidoAlvoRecusa(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-red-500 text-slate-950 font-bold cursor-pointer"
                >
                  Confirmar Recusa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
