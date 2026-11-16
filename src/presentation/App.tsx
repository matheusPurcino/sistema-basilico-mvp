import React, { useCallback, useEffect, useState } from 'react';
import {
  CATEGORIAS_PRODUTO,
  MINUTO_MS,
  RelogioAjustavel,
  formatarBRL,
  reaisParaCentavos,
  type CategoriaProduto,
  type MetodoPagamento,
  type Plataforma,
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
import { BrandLogo } from './components/BrandLogo';
import { LoginView } from './components/LoginView';
import { PosView } from './components/PosView';
import { ThermalPrinterDrawer } from './components/ThermalPrinterDrawer';
import { DeliveryHubView } from './components/DeliveryHubView';
import { CashierHistoryView } from './components/CashierHistoryView';
import { ArchitectureInspectorView } from './components/ArchitectureInspectorView';
import { ChaosSimulatorDock } from './components/ChaosSimulatorDock';
import {
  AcademicBadge,
  IconCashier,
  IconClock,
  IconDelivery,
  IconGraduation,
  IconInspector,
  IconLogout,
  IconPos,
  IconPrinter,
} from './components/Icons';

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

  // Modo Raio-X Acadêmico UNIFEI (OFF por padrão comercial realista)
  const [modoAvaliador, setModoAvaliador] = useState<boolean>(false);

  // Estado de Login
  const [loginInput, setLoginInput] = useState<string>(CREDENCIAIS_HOMOLOGACAO.operador.login);
  const [senhaInput, setSenhaInput] = useState<string>(CREDENCIAIS_HOMOLOGACAO.operador.senhaPura);
  const [erroLogin, setErroLogin] = useState<string | null>(null);

  // Navegação e Filtros PDV
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('PDV');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaProduto | 'TODAS'>('TODAS');
  const [descontoInputReais, setDescontoInputReais] = useState<string>('0,00');
  const [metodoSelecionado, setMetodoSelecionado] = useState<MetodoPagamento>('PIX');

  // Gaveta da Bobina Térmica ESC/POS
  const [gavetaImpressoraAberta, setGavetaImpressoraAberta] = useState<boolean>(false);
  const [gavetaImpressoraFixada, setGavetaImpressoraFixada] = useState<boolean>(false);

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
      }, 6000);
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

  const handleResetarBancoDemo = useCallback(async (): Promise<void> => {
    try {
      sistema?.db.fechar();
    } catch {
      /* banco já fechado ou não inicializado */
    }
    try {
      globalThis.localStorage?.clear();
    } catch {
      /* ambiente sem localStorage */
    }
    SQLiteEngine.apagarArmazenamento(storageNavegador, 'basilico.pdv.web');
    sistema?.nuvem.limpar();

    try {
      await BasilicoSystemFacade.criar({
        storage: storageNavegador,
        nomeBanco: 'basilico.pdv.web',
        chaveCifragem: CHAVE_AES_PADRAO_SISTEMA,
        relogio: relogioGlobal,
        popularSeed: true,
        abrirCaixaAutomaticamente: true,
      });
    } catch (e) {
      console.warn('[Sistema Basílico] Erro ao executar re-seed durante reset manual:', e);
    }

    setErroInicializacao(null);
    window.location.reload();
  }, [sistema]);

  if (carregando) {
    return (
      <div className="min-h-screen bg-[#FAF6EE] text-[#23201E] flex flex-col items-center justify-center p-6">
        <BrandLogo size="lg" className="mb-5 animate-pulse" />
        <div className="w-8 h-8 rounded-full border-3 border-[#E86F2C] border-t-transparent animate-spin mb-3" />
        <h1 className="font-display text-2xl font-bold text-[#23201E]">
          Restaurante Basílico
        </h1>
        <p className="text-xs text-[#6E655F] mt-1">
          Preparando terminal de vendas e banco local seguro...
        </p>
      </div>
    );
  }

  if (erroInicializacao || !sistema) {
    return (
      <div className="min-h-screen bg-[#FAF6EE] text-[#23201E] flex flex-col items-center justify-center p-6">
        <div className="max-w-lg w-full basilico-card rounded-2xl p-6 border-red-300">
          <h2 className="font-display text-xl font-bold text-[#DC2626]">
            Erro ao inicializar banco de dados do terminal
          </h2>
          <p className="text-xs text-[#6E655F] mt-2">{erroInicializacao}</p>
          <button
            type="button"
            onClick={() => void handleResetarBancoDemo()}
            className="mt-4 px-4 py-2.5 rounded-xl bg-[#E86F2C] hover:bg-[#D45D1B] text-white font-bold text-xs cursor-pointer"
          >
            Restaurar Dados de Fábrica e Recarregar
          </button>
        </div>
      </div>
    );
  }

  void versaoUi;

  const usuarioLogado = sistema.auth.getUsuarioAtual();
  const bloqueadaInatividade = sistema.auth.isBloqueadaPorInatividade();
  const estadoMaquina = sistema.caixa.getEstadoMaquina();
  const subEstadoOffline = sistema.caixa.getSubEstadoOffline();
  const carrinho = sistema.getCarrinho();
  const todosProdutos = sistema.listarProdutos();
  const pedidosDelivery = sistema.pedidosRepo.listar();
  const filaReimpressao = sistema.getFilaReimpressao();
  const vendas = sistema.vendasRepo.listar();
  const eventosCompensatorios = sistema.vendasRepo.listarEventosCompensatorios();
  const outboxEventos = sistema.outboxRepo.listar(100);
  const outboxPendentes = sistema.outboxRepo.contarPendentes();
  const transacoesNuvem = sistema.nuvem.listarTransacoes();
  const auditLogs = sistema.auditRepo.listar(80);
  const ultimaImpressao = sistema.impressora.obterUltimaImpressao();
  const historicoImpressoes = sistema.impressora.listarHistorico();
  const popupDelivery = sistema.getUltimoPedidoPopup();
  const statsSqlite = sistema.db.estatisticas();
  const statsNuvem = sistema.nuvem.estatisticas();

  // ───────────────────────── Handlers de Autenticação ─────────────────────────

  const executarLogin = (loginStr: string, senhaStr: string): void => {
    setErroLogin(null);
    try {
      const user = sistema.login(loginStr, senhaStr);
      adicionarToast(
        'SUCESSO',
        `Bom turno, ${user.getNome()}!`,
        modoAvaliador
          ? `Autenticação offline concluída via cache cifrado (${sistema.auth.getUltimoTempoAutenticacaoMs()}ms).`
          : `Você entrou como ${user.getPapel() === 'GERENTE' ? 'Gerente de Loja' : 'Operador de Caixa'}.`,
      );
      atualizarTela();
    } catch (err) {
      setErroLogin(err instanceof Error ? err.message : String(err));
      atualizarTela();
    }
  };

  const handleLogin = (e: React.FormEvent): void => {
    e.preventDefault();
    executarLogin(loginInput, senhaInput);
  };

  const handleAcessoRapido = (perfil: 'OPERADOR' | 'GERENTE', logarDireto: boolean): void => {
    const cred =
      perfil === 'OPERADOR' ? CREDENCIAIS_HOMOLOGACAO.operador : CREDENCIAIS_HOMOLOGACAO.gerente;
    setLoginInput(cred.login);
    setSenhaInput(cred.senhaPura);
    if (logarDireto) {
      executarLogin(cred.login, cred.senhaPura);
    }
  };

  const handleSimularInatividade30Min = (): void => {
    relogioGlobal.avancar(31 * MINUTO_MS);
    sistema.auth.verificarInatividade();
    adicionarToast(
      'ALERTA',
      'Terminal Bloqueado por Inatividade',
      'Mais de 30 minutos sem interação. Faça login novamente para retomar o turno.',
    );
    atualizarTela();
  };

  // ───────────────────────── Handlers do PDV e Produtos ─────────────────────────

  const handleAdicionarCarrinho = async (idProduto: number): Promise<void> => {
    try {
      await sistema.adicionarAoCarrinho(idProduto, 1);
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Erro na comanda', err instanceof Error ? err.message : String(err));
    }
  };

  const handleAlterarQuantidadeCarrinho = async (idProduto: number, novaQtd: number): Promise<void> => {
    try {
      await sistema.alterarQuantidadeCarrinho(idProduto, novaQtd);
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Erro ao atualizar item', err instanceof Error ? err.message : String(err));
    }
  };

  const handleAplicarDesconto = async (): Promise<void> => {
    try {
      const centavos = reaisParaCentavos(descontoInputReais || '0');
      await sistema.aplicarDescontoCarrinho(centavos);
      adicionarToast('INFO', 'Desconto Aplicado', `Desconto de ${formatarBRL(centavos)} salvo na comanda.`);
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
      setGavetaImpressoraAberta(true);
      adicionarToast(
        'SUCESSO',
        `Venda #${String(res.venda.getNumeroSequencial()).padStart(4, '0')} Concluída!`,
        res.sincronizadaImediatamente
          ? `Total de ${formatarBRL(res.venda.getValorTotalCentavos())} aprovado e cupom emitido na impressora.`
          : `Venda salva localmente no modo Offline (${formatarBRL(res.venda.getValorTotalCentavos())}).`,
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
    setProdPrecoReais('54,90');
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

  const handleExcluirProduto = async (p: Produto): Promise<void> => {
    try {
      sistema.removerProduto(p.id);
      if (carrinho.getItens().some((i) => i.getIdProduto() === p.id)) {
        await sistema.removerDoCarrinho(p.id);
      }
      adicionarToast('INFO', 'Prato Removido', `"${p.nome}" foi excluído do catálogo.`);
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Erro ao excluir prato', err instanceof Error ? err.message : String(err));
    }
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
        adicionarToast('SUCESSO', 'Cardápio Atualizado', `"${prodNome}" foi salvo com sucesso.`);
      } else {
        const criado = sistema.cadastrarProduto({
          nome: prodNome,
          descricao: prodDescricao,
          categoria: prodCategoria,
          precoCentavos,
          ativo: true,
        });
        adicionarToast('SUCESSO', 'Novo Prato Adicionado', `"${criado.nome}" já está disponível no PDV.`);
      }
      setModalProdutoAberto(false);
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Dados inválidos no cadastro', err instanceof Error ? err.message : String(err));
    }
  };

  // ───────────────────────── Handlers de Delivery e Impressão ─────────────────────────

  const handleAceitarDelivery = (idInterno: string): void => {
    try {
      const res = sistema.aceitarPedidoDelivery(idInterno);
      if (res.impressoComSucesso) {
        tocarAlertaSonoroDelivery('VENDA_OK');
        setGavetaImpressoraAberta(true);
        adicionarToast(
          'SUCESSO',
          `Pedido #${res.pedido.getCodigoExterno()} em Preparo!`,
          `Via de produção impressa na cozinha (${res.tempoImpressaoMs}ms).`,
        );
      } else {
        tocarAlertaSonoroDelivery('ERRO_IMPRESSORA');
        adicionarToast(
          'ALERTA',
          'Impressora da Cozinha Sem Bobina!',
          res.alertaErroImpressao ?? 'Troque a bobina de papel e clique em Reimprimir.',
        );
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
        setGavetaImpressoraAberta(true);
        adicionarToast(
          'SUCESSO',
          `Via Reimpressa (#${res.pedido.getCodigoExterno()})`,
          'Comanda impressa na cozinha. O pedido entrou em preparo!',
        );
      } else {
        tocarAlertaSonoroDelivery('ERRO_IMPRESSORA');
        adicionarToast('ERRO', 'Impressora continua sem papel', res.alertaErroImpressao ?? 'Sem papel.');
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
      adicionarToast('INFO', `Pedido #${p.getCodigoExterno()} Recusado`, `Motivo enviado: ${motivoRecusaDelivery}`);
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
        'Estorno Autorizado pelo Gerente',
        `Evento compensatório #${ev.idEvento.slice(0, 8)} registrado por ${ev.autorizadoPor}.`,
      );
      setVendaAlvoEstorno(null);
      setMotivoEstorno('');
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Estorno Não Autorizado', err instanceof Error ? err.message : String(err));
    }
  };

  const handleAbrirCaixa = (): void => {
    try {
      const centavos = reaisParaCentavos(saldoAberturaReais);
      sistema.abrirCaixa(centavos);
      adicionarToast('SUCESSO', 'Turno de Caixa Aberto', `Fundo de troco inicial: ${formatarBRL(centavos)}.`);
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
          'Caixa Fechado com Ressalva Offline',
          `${rel.pendenciasOutbox} venda(s) na fila local serão sincronizadas assim que a internet voltar.`,
        );
      } else {
        adicionarToast('SUCESSO', 'Turno Encerrado com Sucesso', `Saldo final: ${formatarBRL(rel.saldoFinalCentavos)}.`);
      }
      atualizarTela();
    } catch (err) {
      adicionarToast('ERRO', 'Erro ao fechar caixa', err instanceof Error ? err.message : String(err));
    }
  };

  // ───────────────────────── Handlers do Simulador de Caos ─────────────────────────

  const handleToggleWan = async (): Promise<void> => {
    const novoOnline = !sistema.isRedeWanOnline();
    const rel = await sistema.definirConectividadeWan(novoOnline);
    if (!novoOnline) {
      adicionarToast(
        'ALERTA',
        'Modo Offline Ativado',
        'Sem conexão com a internet. O PDV continuará registrando vendas localmente.',
      );
    } else if (rel?.sucesso) {
      adicionarToast(
        'SUCESSO',
        'Conexão Restaurada & Sincronizada',
        `${rel.eventosConfirmados} evento(s) enviados para a nuvem (${rel.duplicadosDescartadosNuvem} duplicatas ignoradas).`,
      );
    } else {
      adicionarToast(
        'ERRO',
        'Falha na Sincronização em Lote',
        `${rel?.erro ?? 'Corte de rede'} — Rollback atômico executado e fila preservada localmente.`,
      );
    }
    atualizarTela();
  };

  const handleToggleBobina = (): void => {
    const novoEstado = !sistema.impressora.possuiPapel();
    sistema.impressora.definirBobinaPresente(novoEstado);
    adicionarToast(
      novoEstado ? 'SUCESSO' : 'ALERTA',
      novoEstado ? 'Bobina 80mm Reposta na Impressora' : 'Impressora Sem Bobina de Papel',
      novoEstado
        ? 'A impressora térmica está pronta para emitir cupons e vias da cozinha.'
        : 'Novos pedidos aceitos ficarão retidos na fila até a reposição do papel.',
    );
    atualizarTela();
  };

  const handleToggleToxiproxy = (): void => {
    const novo = !sistema.nuvem.isCorteMeioDoLoteAtivo();
    sistema.nuvem.definirCorteMeioDoLote(novo);
    adicionarToast(
      novo ? 'ALERTA' : 'INFO',
      novo ? 'Simulação: Corte de Rede no Meio do Lote' : 'Servidor Nuvem Normalizado',
      novo
        ? 'A próxima sincronização será interrompida na metade para demonstrar o rollback atômico.'
        : 'Recebimento de lotes normalizado no PostgreSQL.',
    );
    atualizarTela();
  };

  const handleInjetarPedido = (plataforma: Plataforma, duplicado = false): void => {
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
          'Pedido Duplicado Ignorado (Idempotência)',
          `O código externo repetido da plataforma ${plataforma} foi descartado automaticamente.`,
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
  // 1. TELA DE LOGIN SPLIT-SCREEN (QUANDO DESLOGADO OU BLOQUEADO)
  // ═══════════════════════════════════════════════════════════════════════════

  if (!usuarioLogado) {
    return (
      <LoginView
        loginInput={loginInput}
        senhaInput={senhaInput}
        erroLogin={erroLogin}
        bloqueadaInatividade={bloqueadaInatividade}
        itensSalvosCarrinho={carrinho.getQuantidadeItens()}
        totalSalvoCarrinhoCentavos={carrinho.getTotalCentavos()}
        modoAvaliador={modoAvaliador}
        onToggleModoAvaliador={() => setModoAvaliador((v) => !v)}
        onChangeLogin={setLoginInput}
        onChangeSenha={setSenhaInput}
        onSubmitLogin={handleLogin}
        onAcessoRapido={handleAcessoRapido}
      />
    );
  }

  // Contadores de Badges de Navegação
  const qtdPedidosAtivosDelivery = pedidosDelivery.filter(
    (p) => p.getStatus() === 'RECEBIDO' || p.getStatus() === 'PENDENTE_IMPRESSAO',
  ).length;

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. ESTRUTURA PRINCIPAL LOGADA (SIDEBAR ESPRESSO + TOPBAR + WORKSPACE)
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-[#23201E] flex flex-col lg:flex-row">
      {/* Toasts Flutuantes */}
      <div className="fixed top-16 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 rounded-2xl border shadow-xl shadow-stone-900/5 text-xs transition-all ${
              t.tipo === 'SUCESSO'
                ? 'bg-[#EEF7E6] border-[#4E8C22] text-[#1E3B0B]'
                : t.tipo === 'ALERTA'
                  ? 'bg-amber-50 border-[#D97706] text-amber-950'
                  : t.tipo === 'ERRO'
                    ? 'bg-red-50 border-[#DC2626] text-red-950'
                    : 'bg-[#1E1B18] border-[#3E362E] text-[#F7F3EB]'
            }`}
          >
            <div className="font-extrabold text-sm">{t.titulo}</div>
            <div className="mt-0.5 opacity-90 leading-relaxed">{t.mensagem}</div>
          </div>
        ))}
      </div>

      {/* ───────────────────────── SIDEBAR LATERAL ESQUERDA (ESPRESSO #1E1B18) ───────────────────────── */}
      <aside className="lg:w-64 bg-[#1E1B18] text-[#F7F3EB] border-b lg:border-b-0 lg:border-r border-[#332D27] flex flex-col justify-between shrink-0 select-none">
        <div>
          {/* Identidade da Marca Basílico */}
          <div className="p-4 lg:p-5 border-b border-[#332D27] flex items-center gap-3">
            <BrandLogo size="md" />
            <div className="min-w-0">
              <h1 className="font-display text-lg font-bold italic text-[#F7F3EB] leading-none truncate">
                Basílico
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E86F2C] block mt-1">
                Restaurante · POS
              </span>
            </div>
          </div>

          {/* Menu de Navegação Principal (4 Seções) */}
          <nav className="p-3 flex lg:flex-col gap-1.5 overflow-x-auto">
            {(
              [
                {
                  id: 'PDV',
                  titulo: modoAvaliador ? '1. Frente de Caixa (RF01)' : 'Frente de Caixa (PDV)',
                  subtitulo: 'Balcão & Comanda',
                  icone: <IconPos size={18} />,
                  badge: carrinho.getQuantidadeItens() > 0 ? `${carrinho.getQuantidadeItens()}` : null,
                  pulsante: false,
                },
                {
                  id: 'DELIVERY',
                  titulo: modoAvaliador ? '2. Hub Delivery (RF03/RN03)' : 'Hub de Delivery',
                  subtitulo: 'iFood & Aiqfome',
                  icone: <IconDelivery size={18} />,
                  badge: qtdPedidosAtivosDelivery > 0 ? `${qtdPedidosAtivosDelivery} novo(s)` : null,
                  pulsante: qtdPedidosAtivosDelivery > 0,
                },
                {
                  id: 'VENDAS_CAIXA',
                  titulo: modoAvaliador ? '3. Caixa & Estornos (RN02/RN04)' : 'Caixa, Vendas & Estornos',
                  subtitulo: 'Turno & Histórico',
                  icone: <IconCashier size={18} />,
                  badge: vendas.length > 0 ? `${vendas.length}` : null,
                  pulsante: false,
                },
                {
                  id: 'INSPETOR',
                  titulo: modoAvaliador ? '4. Inspetor Outbox & LGPD' : 'Auditoria & Sincronização',
                  subtitulo: 'Outbox, Nuvem & LGPD',
                  icone: <IconInspector size={18} />,
                  badge: outboxPendentes > 0 ? `${outboxPendentes} fila` : null,
                  pulsante: false,
                },
              ] as const
            ).map((item) => {
              const ativo = abaAtiva === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setAbaAtiva(item.id)}
                  className={`px-3.5 py-3 rounded-xl text-left flex items-center justify-between gap-2.5 transition shrink-0 lg:w-full cursor-pointer ${
                    ativo
                      ? 'bg-[#E86F2C] text-white shadow-md shadow-[#E86F2C]/20'
                      : 'text-[#D1C7B8] hover:bg-[#2A2521] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={ativo ? 'text-white' : 'text-[#E86F2C]'}>{item.icone}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold truncate">{item.titulo}</div>
                      <div
                        className={`text-[10px] hidden lg:block truncate ${
                          ativo ? 'text-white/85' : 'text-[#968B82]'
                        }`}
                      >
                        {item.subtitulo}
                      </div>
                    </div>
                  </div>

                  {item.badge && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold shrink-0 ${
                        ativo
                          ? 'bg-[#1E1B18] text-[#F7F3EB]'
                          : item.pulsante
                            ? 'bg-[#EA1D2C] text-white animate-pulse'
                            : 'bg-[#2A2521] text-[#E5DAC8]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Rodapé da Sidebar */}
        <div className="hidden lg:block p-4 border-t border-[#332D27] space-y-2 text-[11px] text-[#968B82]">
          <div className="flex items-center justify-between">
            <span>Unidade:</span>
            <span className="font-semibold text-[#D1C7B8]">Pouso Alegre · MG</span>
          </div>
          {modoAvaliador && (
            <>
              <div className="flex items-center justify-between">
                <span>Criptografia:</span>
                <span className="font-mono text-[#7AC13A]">AES-256-GCM</span>
              </div>
              <div className="pt-2 border-t border-[#2A2521] text-[10px] text-[#B8AEA2]">
                UNIFEI · ECOT11A · Matheus Purcino
              </div>
            </>
          )}
        </div>
      </aside>

      {/* ───────────────────────── COLUNA DIREITA: TOPBAR + WORKSPACE ───────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 pb-14">
        {/* Banner de Alerta Sonoro/Visual de Novo Pedido Delivery */}
        {popupDelivery && (
          <div className="bg-[#E86F2C] text-white px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5 text-xs">
              <span className="px-2 py-0.5 rounded bg-[#1E1B18] text-[#FFB685] font-mono font-extrabold uppercase">
                🔔 Novo {popupDelivery.getPlataforma()} #{popupDelivery.getCodigoExterno()}
              </span>
              <span className="font-bold">
                {popupDelivery.getClienteNome()} — {formatarBRL(popupDelivery.getValorTotalCentavos())} (
                {popupDelivery.getItens().length} item(ns))
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setAbaAtiva('DELIVERY');
                  handleAceitarDelivery(popupDelivery.getIdInterno());
                }}
                className="px-3 py-1 rounded-lg bg-[#1E1B18] hover:bg-[#2F2A25] text-white font-bold text-xs cursor-pointer"
              >
                ✓ Aceitar e Imprimir na Cozinha
              </button>
              <button
                type="button"
                onClick={() => {
                  sistema.dispensarPopupDelivery();
                  atualizarTela();
                }}
                className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold text-xs cursor-pointer"
              >
                Ocultar
              </button>
            </div>
          </div>
        )}

        {/* TOPBAR OPERACIONAL ENXUTA */}
        <header className="bg-white border-b border-[#E6DEC8] px-5 py-2.5 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          {/* Esquerda: Status de Conexão + Status do Caixa */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Pílula de Status de Conexão (Pulso suave apenas em Sincronizando ou Pendente) */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-extrabold border ${
                estadoMaquina === 'OperandoOnline'
                  ? 'bg-[#EEF7E6] border-[#4E8C22]/40 text-[#3E7319]'
                  : estadoMaquina === 'Sincronizando'
                    ? 'bg-amber-50 border-[#D97706] text-amber-900 animate-pulse'
                    : outboxPendentes > 0
                      ? 'bg-red-50 border-[#DC2626]/50 text-[#DC2626] animate-pulse'
                      : 'bg-red-50 border-[#DC2626]/50 text-[#DC2626]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  estadoMaquina === 'OperandoOnline'
                    ? 'bg-[#4E8C22]'
                    : estadoMaquina === 'Sincronizando'
                      ? 'bg-[#D97706]'
                      : 'bg-[#DC2626]'
                }`}
              />
              <span>
                {estadoMaquina === 'OperandoOnline'
                  ? 'Online · Sincronizado'
                  : estadoMaquina === 'Sincronizando'
                    ? 'Sincronizando Lote...'
                    : (
                      <>
                        Modo Offline · <span className="font-mono">{outboxPendentes}</span> na fila
                      </>
                    )}
              </span>
              {modoAvaliador && (
                <span className="font-mono text-[10px] opacity-80">
                  [{estadoMaquina}{subEstadoOffline ? `/${subEstadoOffline}` : ''}]
                </span>
              )}
            </div>

            {/* Status do Caixa Clicável */}
            <button
              type="button"
              onClick={() => setAbaAtiva('VENDAS_CAIXA')}
              className="px-3 py-1.5 rounded-full bg-[#FAF6EE] hover:bg-[#F2E9D8] border border-[#E6DEC8] text-xs font-bold text-[#23201E] flex items-center gap-2 transition cursor-pointer"
              title="Clique para gerenciar o turno ou fechar o caixa"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  sistema.caixa.isAberto() ? 'bg-[#4E8C22]' : 'bg-[#DC2626]'
                }`}
              />
              <span>Caixa {sistema.caixa.isAberto() ? 'Aberto' : 'Fechado'}</span>
              <span className="text-[#968B82]">·</span>
              <span className="font-mono font-extrabold text-[#4E8C22]">
                {formatarBRL(sistema.caixa.getSaldoLocalCentavos())}
              </span>
            </button>
          </div>

          {/* Direita: Impressora Térmica + Toggle Modo Avaliador UNIFEI + Perfil */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Botão da Gaveta da Impressora Térmica (Pulso apenas quando há via pendente/sem papel) */}
            <button
              type="button"
              onClick={() => setGavetaImpressoraAberta((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                !sistema.impressora.possuiPapel() && filaReimpressao.length > 0
                  ? 'bg-red-50 border-[#DC2626] text-[#DC2626] animate-pulse'
                  : !sistema.impressora.possuiPapel()
                    ? 'bg-amber-50 border-[#D97706] text-amber-900'
                    : gavetaImpressoraAberta || gavetaImpressoraFixada
                      ? 'bg-[#1E1B18] text-[#F7F3EB] border-[#1E1B18]'
                      : 'bg-[#FAF6EE] hover:bg-[#F2E9D8] text-[#23201E] border-[#E6DEC8]'
              }`}
            >
              <IconPrinter size={15} />
              <span>
                Impressora ({sistema.impressora.possuiPapel() ? 'OK' : 'Sem Papel'})
              </span>
              {historicoImpressoes.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#E86F2C] text-white font-mono text-[10px]">
                  {historicoImpressoes.length}
                </span>
              )}
            </button>

            {/* Chave Modo Avaliador UNIFEI (ON/OFF) */}
            <button
              type="button"
              onClick={() => setModoAvaliador((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
                modoAvaliador
                  ? 'bg-[#FFF0E6] border-[#E86F2C] text-[#C85212]'
                  : 'bg-[#FAF6EE] hover:bg-[#F2E9D8] border-[#E6DEC8] text-[#6E655F]'
              }`}
              title="Exibe ou oculta as siglas de requisitos acadêmicos (RF, RNF, RN e Casos de Teste CT01-CT14)"
            >
              <IconGraduation size={15} />
              <span>Modo Avaliador UNIFEI: {modoAvaliador ? 'ON' : 'OFF'}</span>
            </button>

            {/* Perfil do Usuário + Inatividade + Sair */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#E6DEC8]">
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold ${
                  usuarioLogado.getPapel() === 'GERENTE'
                    ? 'bg-[#EEF7E6] text-[#3E7319]'
                    : 'bg-[#F2E9D8] text-[#23201E]'
                }`}
              >
                {usuarioLogado.getNome()} ({usuarioLogado.getPapel()})
              </span>

              <button
                type="button"
                onClick={handleSimularInatividade30Min}
                title="Simular 30 minutos de inatividade (Bloqueio automático da sessão)"
                className="p-1.5 rounded-lg bg-[#FAF6EE] hover:bg-amber-100 border border-[#E6DEC8] text-[#6E655F] hover:text-amber-900 transition cursor-pointer"
              >
                <IconClock size={15} />
              </button>

              <button
                type="button"
                onClick={() => {
                  sistema.logout();
                  atualizarTela();
                }}
                title="Trocar operador ou sair do terminal"
                className="px-2.5 py-1.5 rounded-lg bg-[#FAF6EE] hover:bg-red-50 border border-[#E6DEC8] text-xs font-bold text-[#6E655F] hover:text-[#DC2626] flex items-center gap-1 transition cursor-pointer"
              >
                <IconLogout size={14} />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </header>

        {/* WORKSPACE PRINCIPAL */}
        <main
          className={`flex-1 p-4 lg:p-6 max-w-[1600px] w-full mx-auto transition-all ${
            gavetaImpressoraFixada ? 'xl:pr-[390px]' : ''
          }`}
        >
          {abaAtiva === 'PDV' && (
            <PosView
              produtos={todosProdutos}
              carrinho={carrinho}
              caixaAberto={sistema.caixa.isAberto()}
              modoAvaliador={modoAvaliador}
              categoriaFiltro={categoriaFiltro}
              onChangeCategoria={setCategoriaFiltro}
              metodoSelecionado={metodoSelecionado}
              onChangeMetodo={setMetodoSelecionado}
              descontoInputReais={descontoInputReais}
              onChangeDescontoInput={setDescontoInputReais}
              onAplicarDesconto={() => void handleAplicarDesconto()}
              onAdicionarCarrinho={(id) => void handleAdicionarCarrinho(id)}
              onAlterarQuantidadeCarrinho={(id, qtd) => void handleAlterarQuantidadeCarrinho(id, qtd)}
              onLimparCarrinho={() => void sistema.limparCarrinho().then(atualizarTela)}
              onFinalizarVenda={() => void handleFinalizarVenda()}
              onAbrirModalNovoProduto={abrirModalNovoProduto}
              onAbrirModalEditarProduto={abrirModalEditarProduto}
              onExcluirProduto={(p) => void handleExcluirProduto(p)}
              onIrParaCaixa={() => setAbaAtiva('VENDAS_CAIXA')}
            />
          )}

          {abaAtiva === 'DELIVERY' && (
            <DeliveryHubView
              pedidos={pedidosDelivery}
              filaReimpressao={filaReimpressao}
              possuiPapel={sistema.impressora.possuiPapel()}
              versaoTls={sistema.ifoodAdapter.getVersaoTls()}
              renovacoesOAuth={sistema.ifoodAdapter.getTokenOAuth().renovacoes}
              modoAvaliador={modoAvaliador}
              onAceitarPedido={handleAceitarDelivery}
              onReimprimirPedido={handleReimprimirDelivery}
              onAbrirModalRecusa={(id) => setPedidoAlvoRecusa(id)}
              onConcluirPedido={(id) => {
                const ped = sistema.concluirPedidoDelivery(id);
                adicionarToast('SUCESSO', 'Entrega Concluída', `Pedido #${ped.getCodigoExterno()} finalizado.`);
                atualizarTela();
              }}
              onInjetarPedido={handleInjetarPedido}
              onToggleBobina={handleToggleBobina}
            />
          )}

          {abaAtiva === 'VENDAS_CAIXA' && (
            <CashierHistoryView
              caixaAberto={sistema.caixa.isAberto()}
              saldoAtualCentavos={sistema.caixa.getSaldoLocalCentavos()}
              saldoInicialCentavos={sistema.caixa.getSaldoInicialCentavos()}
              operadorAbertura={sistema.caixa.getOperadorAbertura()}
              outboxPendentes={outboxPendentes}
              vendas={vendas}
              eventosCompensatorios={eventosCompensatorios}
              ultimoFechamento={ultimoFechamento}
              saldoAberturaReais={saldoAberturaReais}
              modoAvaliador={modoAvaliador}
              onChangeSaldoAbertura={setSaldoAberturaReais}
              onAbrirCaixa={handleAbrirCaixa}
              onFecharCaixa={handleFecharCaixa}
              onSolicitarEstorno={(idVenda) => {
                setVendaAlvoEstorno(idVenda);
                setMotivoEstorno('Solicitação do cliente / erro de lançamento');
              }}
            />
          )}

          {abaAtiva === 'INSPETOR' && (
            <ArchitectureInspectorView
              estadoMaquina={estadoMaquina}
              subEstadoOffline={subEstadoOffline}
              outboxEventos={outboxEventos}
              outboxPendentes={outboxPendentes}
              transacoesNuvem={transacoesNuvem}
              auditLogs={auditLogs}
              statsSqlite={statsSqlite}
              statsNuvem={statsNuvem}
              modoAvaliador={modoAvaliador}
              onReenviarUltimoLoteIdempotencia={() =>
                void sistema.syncWorker.reenviarUltimoLoteConfirmado().then((r) => {
                  adicionarToast(
                    'INFO',
                    'Teste de Idempotência Concluído',
                    `Reenviados: ${r.enviados} | Inseridos: ${r.inseridos} | Duplicados descartados: ${r.duplicadosDescartados}`,
                  );
                  atualizarTela();
                })
              }
              onExecutarAnonimizacaoLgpd={() => {
                const rel = sistema.executarRotinaAnonimizacaoLgpd(180);
                adicionarToast(
                  'SUCESSO',
                  'Rotina LGPD Executada',
                  `Avaliados: ${rel.avaliados} | Anonimizados: ${rel.anonimizados} | Vigentes preservados: ${rel.preservadosPrazoVigente}.`,
                );
                atualizarTela();
              }}
            />
          )}
        </main>
      </div>

      {/* ───────────────────────── BOBINA TÉRMICA ESC/POS INTELIGENTE (DRAWER) ───────────────────────── */}
      <ThermalPrinterDrawer
        aberto={gavetaImpressoraAberta}
        fixado={gavetaImpressoraFixada}
        possuiPapel={sistema.impressora.possuiPapel()}
        descricaoImpressora={sistema.impressora.descricao}
        ultimaImpressao={ultimaImpressao}
        historicoImpressoes={historicoImpressoes}
        modoAvaliador={modoAvaliador}
        onFechar={() => setGavetaImpressoraAberta(false)}
        onToggleFixado={() => setGavetaImpressoraFixada((v) => !v)}
        onToggleBobina={handleToggleBobina}
      />

      {/* ───────────────────────── GAVETA RETRÁTIL DE CAOS & SIMULAÇÃO ───────────────────────── */}
      <ChaosSimulatorDock
        wanOnline={sistema.isRedeWanOnline()}
        possuiPapel={sistema.impressora.possuiPapel()}
        corteToxiproxyAtivo={sistema.nuvem.isCorteMeioDoLoteAtivo()}
        onToggleWan={() => void handleToggleWan()}
        onToggleBobina={handleToggleBobina}
        onToggleToxiproxy={handleToggleToxiproxy}
        onInjetarPedido={handleInjetarPedido}
        onSimularQuedaEletrica={() => void handleSimularQuedaEletrica()}
        onResetarBancoDemo={() => void handleResetarBancoDemo()}
      />

      {/* ───────────────────────── MODAL: CRUD DE PRODUTO ───────────────────────── */}
      {modalProdutoAberto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="basilico-card shadow-xl shadow-stone-900/10 rounded-2xl max-w-md w-full p-6 bg-white">
            <h3 className="font-display text-xl font-bold text-[#23201E] mb-4">
              {produtoEditando ? `Editar Prato #${produtoEditando.id}` : 'Cadastrar Novo Prato'}
            </h3>
            <form onSubmit={handleSalvarProduto} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#23201E] mb-1">Nome do Prato ou Bebida</label>
                <input
                  type="text"
                  value={prodNome}
                  onChange={(e) => setProdNome(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-[#23201E] font-medium focus:outline-none focus:border-[#E86F2C]"
                  placeholder="Ex.: Ravioli di Zucca al Burro e Salvia"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-[#23201E] mb-1">Descrição Gastronômica</label>
                <textarea
                  value={prodDescricao}
                  onChange={(e) => setProdDescricao(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-[#23201E] focus:outline-none focus:border-[#E86F2C]"
                  rows={2}
                  placeholder="Ingredientes principais e modo de preparo..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#23201E] mb-1">Categoria</label>
                  <select
                    value={prodCategoria}
                    onChange={(e) => setProdCategoria(e.target.value as CategoriaProduto)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-[#23201E] font-semibold"
                  >
                    {CATEGORIAS_PRODUTO.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-[#23201E] mb-1">Preço de Venda (R$)</label>
                  <input
                    type="text"
                    value={prodPrecoReais}
                    onChange={(e) => setProdPrecoReais(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-[#23201E] font-mono font-bold"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#F2E9D8]">
                <button
                  type="button"
                  onClick={() => setModalProdutoAberto(false)}
                  className="px-4 py-2 rounded-xl bg-[#F2E9D8] hover:bg-[#E6DEC8] text-[#23201E] font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#E86F2C] hover:bg-[#D45D1B] text-white font-bold shadow-sm cursor-pointer"
                >
                  Salvar no Cardápio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────── MODAL: AUTORIZAR ESTORNO RBAC (RN02) ───────────────────────── */}
      {vendaAlvoEstorno && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="basilico-card shadow-xl shadow-stone-900/10 rounded-2xl max-w-md w-full p-6 bg-white border-t-4 border-t-[#DC2626]">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-xl font-bold text-[#23201E]">
                Autorização de Estorno
              </h3>
              <AcademicBadge codigo="RN02 · RBAC" visivel={modoAvaliador} />
            </div>
            <p className="text-xs text-[#6E655F] mt-1 mb-4 leading-relaxed">
              Por conformidade fiscal, a venda original permanece registrada e um evento compensatório auditável será emitido.
            </p>
            <form onSubmit={(e) => void handleConfirmarEstorno(e)} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#23201E] mb-1">
                  Motivo do Estorno (mínimo 5 caracteres)
                </label>
                <input
                  type="text"
                  value={motivoEstorno}
                  onChange={(e) => setMotivoEstorno(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-[#23201E] font-medium"
                  required
                />
              </div>

              {usuarioLogado.getPapel() !== 'GERENTE' && (
                <div className="p-3.5 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] space-y-2.5">
                  <div className="text-[11px] font-extrabold text-[#E86F2C]">
                    🔒 Permissão de Gerente Necessária
                  </div>
                  <input
                    type="text"
                    value={loginGerenteModal}
                    onChange={(e) => setLoginGerenteModal(e.target.value)}
                    placeholder="Login do Gerente"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DEC8] text-[#23201E]"
                  />
                  <input
                    type="password"
                    value={senhaGerenteModal}
                    onChange={(e) => setSenhaGerenteModal(e.target.value)}
                    placeholder="Senha do Gerente"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-[#E6DEC8] text-[#23201E]"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#F2E9D8]">
                <button
                  type="button"
                  onClick={() => setVendaAlvoEstorno(null)}
                  className="px-4 py-2 rounded-xl bg-[#F2E9D8] text-[#23201E] font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white font-extrabold shadow-sm cursor-pointer"
                >
                  Confirmar Estorno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────── MODAL: RECUSAR PEDIDO DELIVERY ───────────────────────── */}
      {pedidoAlvoRecusa && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="basilico-card shadow-xl shadow-stone-900/10 rounded-2xl max-w-md w-full p-6 bg-white">
            <h3 className="font-display text-xl font-bold text-[#23201E] mb-2">
              Recusar Pedido de Delivery
            </h3>
            <p className="text-xs text-[#6E655F] mb-4">
              Informe o motivo que será enviado automaticamente à plataforma parceira.
            </p>
            <form onSubmit={handleConfirmarRecusaDelivery} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-[#23201E] mb-1">Justificativa</label>
                <input
                  type="text"
                  value={motivoRecusaDelivery}
                  onChange={(e) => setMotivoRecusaDelivery(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-[#23201E]"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#F2E9D8]">
                <button
                  type="button"
                  onClick={() => setPedidoAlvoRecusa(null)}
                  className="px-4 py-2 rounded-xl bg-[#F2E9D8] text-[#23201E] font-bold cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white font-bold cursor-pointer"
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
