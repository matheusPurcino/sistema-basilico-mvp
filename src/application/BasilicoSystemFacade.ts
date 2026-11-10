import {
  Caixa,
  Carrinho,
  DomainError,
  ItemVenda,
  OperadorCaixa,
  PRAZO_RETENCAO_LGPD_DIAS,
  RelogioAjustavel,
  Venda,
  gerarUuidV4,
  prazoLgpdVencido,
  type Clock,
  type EventoCompensatorio,
  type MetodoPagamento,
  type NovoProduto,
  type PedidoDelivery,
  type Plataforma,
  type PoliticaLgpd,
  type Produto,
  type RelatorioFechamento,
  type Usuario,
} from '../domain';
import {
  AiqfomeAdapter,
  BcryptHasher,
  ESQUEMA_LOCAL,
  EscPosThermalSimulator,
  IFoodAdapter,
  MemoryStorage,
  PostgresCloudMock,
  SQLiteEngine,
  SqliteAuditLogRepository,
  SqliteCaixaRepository,
  SqliteCarrinhoRepository,
  SqliteOutboxRepository,
  SqlitePedidoRepository,
  SqliteProdutoRepository,
  SqliteUsuarioRepository,
  SqliteVendaRepository,
  TELEFONE_CLIENTE_FIDELIZADO_DEMO,
  popularDadosIniciais,
  type KeyValueStorage,
  type PayloadPedidoParceiro,
  type ResultadoRecepcaoDelivery,
} from '../infrastructure';
import { AuthSessionService } from './AuthSessionService';
import { SyncWorker, type RelatorioSincronizacao } from './SyncWorker';

export const CHAVE_AES_PADRAO_SISTEMA = 'BASILICO-AES256-SQLCIPHER-KEY-2026-UNIFEI';

export interface OpcoesCriacaoSistema {
  storage?: KeyValueStorage;
  nomeBanco?: string;
  chaveCifragem?: string | null;
  relogio?: Clock;
  nuvem?: PostgresCloudMock;
  popularSeed?: boolean;
  abrirCaixaAutomaticamente?: boolean;
}

export interface ResultadoFinalizacaoVenda {
  venda: Venda;
  cupom: string;
  seqOutbox: number;
  sincronizadaImediatamente: boolean;
  tempoProcessamentoMs: number;
}

export interface ResultadoAceiteDelivery {
  pedido: PedidoDelivery;
  impressoComSucesso: boolean;
  parceiroNotificado: boolean;
  alertaErroImpressao: string | null;
  tempoImpressaoMs: number;
}

export interface ResultadoAnonimizacaoLgpd {
  avaliados: number;
  anonimizados: number;
  preservadosPrazoVigente: number;
  preservadosFidelizados: number;
  idsAnonimizados: string[];
}

/**
 * BasilicoSystemFacade — Controlador MVC / Fachada de Casos de Uso da camada
 * de Aplicação. Orquestra Domínio e Infraestrutura para o Frontend React/Electron
 * e para a suíte de testes automatizados (CT01 a CT14).
 */
export class BasilicoSystemFacade {
  readonly db: SQLiteEngine;
  readonly storage: KeyValueStorage;
  readonly nomeBanco: string;
  readonly chaveCifragem: string;
  readonly relogio: Clock;
  readonly hasher: BcryptHasher;

  readonly usuariosRepo: SqliteUsuarioRepository;
  readonly produtosRepo: SqliteProdutoRepository;
  readonly vendasRepo: SqliteVendaRepository;
  readonly outboxRepo: SqliteOutboxRepository;
  readonly pedidosRepo: SqlitePedidoRepository;
  readonly auditRepo: SqliteAuditLogRepository;
  readonly carrinhoRepo: SqliteCarrinhoRepository;
  readonly caixaRepo: SqliteCaixaRepository;

  readonly nuvem: PostgresCloudMock;
  readonly impressora: EscPosThermalSimulator;
  readonly ifoodAdapter: IFoodAdapter;
  readonly aiqfomeAdapter: AiqfomeAdapter;

  readonly caixa: Caixa;
  readonly auth: AuthSessionService;
  readonly syncWorker: SyncWorker;

  private carrinho: Carrinho;
  private redeWanOnline = true;
  private contadorInjecaoDelivery = 9000;
  private ultimoPedidoPopup: PedidoDelivery | null = null;
  private readonly filaReimpressaoIds = new Set<string>();
  private readonly telefonesFidelizados = new Set<string>([TELEFONE_CLIENTE_FIDELIZADO_DEMO]);

  private constructor(params: {
    db: SQLiteEngine;
    storage: KeyValueStorage;
    nomeBanco: string;
    chaveCifragem: string;
    relogio: Clock;
    nuvem: PostgresCloudMock;
  }) {
    this.db = params.db;
    this.storage = params.storage;
    this.nomeBanco = params.nomeBanco;
    this.chaveCifragem = params.chaveCifragem;
    this.relogio = params.relogio;
    this.nuvem = params.nuvem;
    this.hasher = new BcryptHasher();

    this.usuariosRepo = new SqliteUsuarioRepository(this.db, this.hasher);
    this.produtosRepo = new SqliteProdutoRepository(this.db);
    this.vendasRepo = new SqliteVendaRepository(this.db);
    this.outboxRepo = new SqliteOutboxRepository(this.db);
    this.pedidosRepo = new SqlitePedidoRepository(this.db);
    this.auditRepo = new SqliteAuditLogRepository(this.db);
    this.carrinhoRepo = new SqliteCarrinhoRepository(this.db);
    this.caixaRepo = new SqliteCaixaRepository(this.db);

    this.impressora = new EscPosThermalSimulator();
    this.ifoodAdapter = new IFoodAdapter(this.pedidosRepo, this.auditRepo, this.relogio);
    this.aiqfomeAdapter = new AiqfomeAdapter(this.pedidosRepo, this.auditRepo, this.relogio);

    this.caixa = new Caixa({
      relogio: this.relogio,
      monitorRede: () => this.redeWanOnline,
    });
    this.syncWorker = new SyncWorker(
      this.outboxRepo,
      this.vendasRepo,
      this.auditRepo,
      this.nuvem,
      this.caixa,
      { relogio: this.relogio },
    );
    this.caixa.configurarPortas({
      sincronizador: async () => {
        const rel = await this.syncWorker.sincronizarTudo();
        await this.db.persistir();
        return rel.sucesso;
      },
    });

    this.auth = new AuthSessionService(this.usuariosRepo, this.auditRepo, this.hasher, this.relogio);

    // Restaura estado do Caixa, Vendas, Eventos Compensatórios e Carrinho WAL (RPO = 0)
    const snapCarrinho = this.carrinhoRepo.carregar();
    this.carrinho = snapCarrinho ? Carrinho.fromSnapshot(snapCarrinho) : new Carrinho();

    const estadoCaixa = this.caixaRepo.carregarEstado();
    const vendas = this.vendasRepo.listar().slice().reverse();
    const estornos = this.vendasRepo.listarEventosCompensatorios();
    if (estadoCaixa) {
      this.caixa.restaurar(estadoCaixa, vendas, estornos);
    }
    for (const p of this.pedidosRepo.listar()) {
      this.caixa.adicionarPedido(p);
      if (p.getStatus() === 'PENDENTE_IMPRESSAO') {
        this.filaReimpressaoIds.add(p.getIdInterno());
      }
    }
    this.caixa.atualizarPendencias(this.outboxRepo.contarPendentes());
  }

  static async criar(opcoes: OpcoesCriacaoSistema = {}): Promise<BasilicoSystemFacade> {
    const storage = opcoes.storage ?? new MemoryStorage();
    const nomeBanco = opcoes.nomeBanco ?? 'basilico.pdv';
    const chave = opcoes.chaveCifragem === undefined ? CHAVE_AES_PADRAO_SISTEMA : opcoes.chaveCifragem;
    const relogio = opcoes.relogio ?? new RelogioAjustavel();
    const nuvem = opcoes.nuvem ?? new PostgresCloudMock(storage);

    const db = await SQLiteEngine.abrir({
      nome: nomeBanco,
      storage,
      chave,
      esquema: ESQUEMA_LOCAL,
    });

    const sistema = new BasilicoSystemFacade({
      db,
      storage,
      nomeBanco,
      chaveCifragem: chave ?? '',
      relogio,
      nuvem,
    });

    if (opcoes.popularSeed !== false) {
      popularDadosIniciais(sistema.usuariosRepo, sistema.produtosRepo, sistema.pedidosRepo, relogio.agora());
      for (const p of sistema.pedidosRepo.listar()) {
        sistema.caixa.adicionarPedido(p);
      }
    }

    if (opcoes.abrirCaixaAutomaticamente !== false && !sistema.caixa.isAberto() && !sistema.caixaRepo.carregarEstado()) {
      sistema.caixa.abrir(25000, 'sistema');
      sistema.caixaRepo.salvarEstado(sistema.caixa.exportarEstado());
    }

    await db.persistir();
    return sistema;
  }

  /**
   * Simula queda abrupta de energia e reinicialização do PDV sobre o mesmo
   * armazenamento WAL cifrado (RNF01.3 / CT12 — RPO = 0, RTO <= 2 min).
   */
  async simularQuedaEletricaEReiniciar(): Promise<BasilicoSystemFacade> {
    await this.db.persistir();
    this.db.fechar();
    return BasilicoSystemFacade.criar({
      storage: this.storage,
      nomeBanco: this.nomeBanco,
      chaveCifragem: this.chaveCifragem,
      relogio: this.relogio,
      nuvem: this.nuvem,
      popularSeed: false,
      abrirCaixaAutomaticamente: false,
    });
  }

  // ───────────────────────── 1. Autenticação, RBAC e Caixa ─────────────────────────

  login(nomeOuEmail: string, senhaPura: string): Usuario {
    return this.auth.login(nomeOuEmail, senhaPura);
  }

  logout(): void {
    this.auth.logout();
  }

  abrirCaixa(saldoInicialCentavos: number): void {
    const usuario = this.auth.exigirSessaoAtiva();
    if (usuario instanceof OperadorCaixa) {
      usuario.abrirCaixa(this.caixa, saldoInicialCentavos);
    } else {
      this.caixa.abrir(saldoInicialCentavos, usuario.getNome());
    }
    this.caixaRepo.salvarEstado(this.caixa.exportarEstado());
    this.auditRepo.registrar({
      dataHora: this.relogio.agora().toISOString(),
      usuario: usuario.getNome(),
      acao: 'CAIXA_ABERTO',
      categoria: 'CAIXA',
      entidadeId: null,
      detalhes: `Caixa aberto com fundo de troco de ${saldoInicialCentavos} centavos.`,
    });
    void this.db.persistir();
  }

  /**
   * Fecha o caixa aplicando a RN04 (CT11): se houver vendas/eventos não
   * sincronizados na Outbox, emite alerta de pendência, registra ressalva no
   * relatório de fechamento e preserva a fila intacta para o próximo ciclo online.
   */
  fecharCaixa(): RelatorioFechamento {
    const usuario = this.auth.exigirSessaoAtiva();
    this.caixa.atualizarPendencias(this.outboxRepo.contarPendentes());

    const relatorio =
      usuario instanceof OperadorCaixa
        ? usuario.fecharCaixa(this.caixa)
        : this.caixa.fechar(usuario.getNome());

    this.db.transacao(() => {
      this.caixaRepo.salvarEstado(this.caixa.exportarEstado());
      this.caixaRepo.salvarFechamento(relatorio);
      this.auditRepo.registrar({
        dataHora: this.relogio.agora().toISOString(),
        usuario: usuario.getNome(),
        acao: relatorio.alertaPendencia ? 'CAIXA_FECHADO_COM_RESSALVA_RN04' : 'CAIXA_FECHADO',
        categoria: 'CAIXA',
        entidadeId: relatorio.idFechamento,
        detalhes: relatorio.alertaPendencia
          ? `Fechamento offline com ${relatorio.pendenciasOutbox} pendência(s) na Outbox (RN04).`
          : `Fechamento concluído sem pendências.`,
      });
    });

    void this.db.persistir();
    return relatorio;
  }

  // ───────────────────────── 2. Catálogo de Produtos (CRUD) ─────────────────────────

  listarProdutos(incluirInativos = false): Produto[] {
    return this.produtosRepo.listar(incluirInativos);
  }

  cadastrarProduto(novo: NovoProduto): Produto {
    const p = this.produtosRepo.criar(novo);
    void this.db.persistir();
    return p;
  }

  atualizarProduto(produto: Produto): void {
    this.produtosRepo.atualizar(produto);
    void this.db.persistir();
  }

  removerProduto(id: number): void {
    this.produtosRepo.remover(id);
    void this.db.persistir();
  }

  // ───────────────────────── 3. Carrinho WAL (RPO = 0) & Venda Presencial ─────────────────────────

  getCarrinho(): Carrinho {
    return this.carrinho;
  }

  async adicionarAoCarrinho(idProduto: number, quantidade = 1): Promise<void> {
    const p = this.produtosRepo.buscar(idProduto);
    if (!p) throw new DomainError(`Produto #${idProduto} não encontrado.`);
    this.carrinho.adicionar(p, quantidade);
    this.persistirCarrinhoWal();
    await this.db.persistir();
  }

  async alterarQuantidadeCarrinho(idProduto: number, quantidade: number): Promise<void> {
    this.carrinho.alterarQuantidade(idProduto, quantidade);
    this.persistirCarrinhoWal();
    await this.db.persistir();
  }

  async removerDoCarrinho(idProduto: number): Promise<void> {
    this.carrinho.remover(idProduto);
    this.persistirCarrinhoWal();
    await this.db.persistir();
  }

  async aplicarDescontoCarrinho(descontoCentavos: number): Promise<void> {
    this.carrinho.aplicarDesconto(descontoCentavos);
    this.persistirCarrinhoWal();
    await this.db.persistir();
  }

  async limparCarrinho(): Promise<void> {
    this.carrinho.limpar();
    this.carrinhoRepo.limpar();
    await this.db.persistir();
  }

  private persistirCarrinhoWal(): void {
    if (this.carrinho.estaVazio()) {
      this.carrinhoRepo.limpar();
    } else {
      this.carrinhoRepo.salvar(this.carrinho.toSnapshot(), this.relogio.agora().toISOString());
    }
  }

  /**
   * Finaliza a venda presencial no PDV em < 2s (RF01 / RF02 / CT01 / CT03 / CT11).
   *
   * Grava na MESMA transação ACID local:
   *   1) Registro da venda e itens (`vendas` + `itens_venda`)
   *   2) Evento `VENDA_REGISTRADA` na `outbox_events` com `UUID v4` e `seq` monotônico
   *   3) Atualização do saldo local do `Caixa` e limpeza do `carrinho_aberto`
   *   4) Registro em `audit_logs`
   *
   * Se a gravação na Outbox falhar, toda a transação sofre ROLLBACK integral (CT03).
   */
  async finalizarVendaCarrinho(metodo: MetodoPagamento): Promise<ResultadoFinalizacaoVenda> {
    const inicio = performance.now();
    if (!this.caixa.isAberto()) {
      throw new DomainError('O caixa está fechado. Abra o caixa antes de finalizar a venda.');
    }
    if (this.carrinho.estaVazio()) {
      throw new DomainError('O carrinho está vazio.');
    }

    const operador = this.auth.getUsuarioAtual()?.getNome() ?? 'operador';
    const numeroSeq = this.vendasRepo.proximoNumeroSequencial();
    const agora = this.relogio.agora();
    const venda = new Venda(numeroSeq, agora);
    venda.definirOperador(operador);

    for (const item of this.carrinho.getItens()) {
      venda.adicionarItem(new ItemVenda(
        item.getIdProduto(),
        item.getNomeProduto(),
        item.getQuantidade(),
        item.getPrecoUnitarioCentavos(),
      ));
    }
    if (this.carrinho.getDescontoCentavos() > 0) {
      venda.aplicarDesconto(this.carrinho.getDescontoCentavos());
    }
    if (!venda.registrarPagamento(metodo)) {
      throw new DomainError(`Método de pagamento inválido: ${metodo}`);
    }

    // Subestado da máquina de estados offline: AguardandoVendaOffline -> GravandoLocal
    this.caixa.iniciarGravacaoLocal();
    let seqOutbox = 0;

    try {
      this.db.transacao(() => {
        this.vendasRepo.salvar(venda);
        seqOutbox = this.outboxRepo.registrar({
          idEvento: gerarUuidV4(),
          tipo: 'VENDA_REGISTRADA',
          agregadoId: venda.getIdVenda(),
          payload: venda.toSnapshot(),
          criadoEm: agora.toISOString(),
        });
        this.caixaRepo.salvarEstado({
          ...this.caixa.exportarEstado(),
          saldoLocalCentavos: this.caixa.getSaldoLocalCentavos() + venda.getValorTotalCentavos(),
        });
        this.carrinhoRepo.limpar();
        this.auditRepo.registrar({
          dataHora: agora.toISOString(),
          usuario: operador,
          acao: 'VENDA_REGISTRADA',
          categoria: 'VENDA',
          entidadeId: venda.getIdVenda(),
          detalhes: `Venda #${numeroSeq} (${metodo}) de ${venda.getValorTotalCentavos()} centavos gravada com Outbox seq #${seqOutbox}.`,
        });
      });
    } catch (erro) {
      this.caixa.concluirGravacaoLocal();
      throw erro;
    }

    // Só muta estado em memória após o COMMIT ACID ter tido sucesso
    this.caixa.registrarVenda(venda);
    this.carrinho.limpar();
    this.caixa.concluirGravacaoLocal();
    this.caixa.atualizarPendencias(this.outboxRepo.contarPendentes());

    const cupom = venda.gerarCupom();
    this.impressora.imprimirCupomTexto(`VENDA #${String(numeroSeq).padStart(4, '0')}`, cupom, agora);

    let sincronizadaImediatamente = false;
    if (this.redeWanOnline && !this.nuvem.isCorteMeioDoLoteAtivo() && !this.nuvem.isHttp503Ativo()) {
      sincronizadaImediatamente = await this.caixa.sincronizarNuvem();
    }

    await this.db.persistir();
    const tempoProcessamentoMs = Math.max(1, Math.round(performance.now() - inicio));

    return {
      venda,
      cupom,
      seqOutbox,
      sincronizadaImediatamente,
      tempoProcessamentoMs,
    };
  }

  // ───────────────────────── 4. Estorno RBAC (RN02 / CT02) ─────────────────────────

  /**
   * Autoriza estorno de venda (RN02 / CT02):
   * - Exige sessão ou credencial explícita de `Gerente` (lança `PermissaoNegadaError` para `Operador`).
   * - Não apaga a venda original; marca `estornada = true`.
   * - Gera `EventoCompensatorio` vinculado ao UUID original.
   * - Grava na Outbox e no log de auditoria imutável na mesma transação ACID.
   */
  async autorizarEstornoVenda(
    idVenda: string,
    motivo: string,
    credencialGerente?: { login: string; senhaPura: string },
  ): Promise<EventoCompensatorio> {
    const gerente = this.auth.obterGerenteAutorizado(credencialGerente);
    const agora = this.relogio.agora();
    const evento = gerente.autorizarEstorno(idVenda, motivo, this.caixa, agora);

    this.db.transacao(() => {
      this.vendasRepo.marcarEstornada(idVenda);
      this.vendasRepo.salvarEventoCompensatorio(evento);
      this.outboxRepo.registrar({
        idEvento: evento.idEvento,
        tipo: 'ESTORNO_REGISTRADO',
        agregadoId: evento.idVendaOriginal,
        payload: evento,
        criadoEm: agora.toISOString(),
      });
      this.caixaRepo.salvarEstado(this.caixa.exportarEstado());
      this.auditRepo.registrar({
        dataHora: agora.toISOString(),
        usuario: gerente.getNome(),
        acao: 'ESTORNO_AUTORIZADO_RN02',
        categoria: 'ESTORNO',
        entidadeId: idVenda,
        detalhes: `Estorno autorizado por GERENTE (${gerente.getNome()}). Motivo: "${evento.motivo}". Evento compensatório: ${evento.idEvento}.`,
      });
    });

    this.caixa.atualizarPendencias(this.outboxRepo.contarPendentes());
    if (this.redeWanOnline && !this.nuvem.isCorteMeioDoLoteAtivo() && !this.nuvem.isHttp503Ativo()) {
      await this.caixa.sincronizarNuvem();
    }
    await this.db.persistir();
    return evento;
  }

  // ───────────────────────── 5. Hub Central de Delivery & Impressão (RF03 / RF04 / RN03) ─────────────────────────

  receberPedidoDelivery(plataforma: Plataforma, payload: PayloadPedidoParceiro): ResultadoRecepcaoDelivery {
    const adapter = plataforma === 'IFOOD' ? this.ifoodAdapter : this.aiqfomeAdapter;
    const res = adapter.receberWebhook(payload);
    if (res.status === 'ACEITO_FILA' && res.pedido) {
      this.caixa.adicionarPedido(res.pedido);
      this.ultimoPedidoPopup = res.pedido;
      void this.db.persistir();
    }
    return res;
  }

  injetarPedidoSimulado(plataforma: Plataforma, forcarDuplicado = false): ResultadoRecepcaoDelivery {
    const pedidosExistentes = this.pedidosRepo.listar().filter((p) => p.getPlataforma() === plataforma);
    const codigo =
      forcarDuplicado && pedidosExistentes.length > 0
        ? pedidosExistentes[0].getCodigoExterno()
        : `${plataforma}-${++this.contadorInjecaoDelivery}`;

    const pratos = this.produtosRepo.listar();
    const pratoEscolhido = pratos[(this.contadorInjecaoDelivery - 1) % Math.max(1, pratos.length)];
    const clientes = [
      { nome: 'Mariana Faria Nogueira', fone: '(35) 99711-3090', end: 'Av. Tuany Toledo, 520 - Fátima II, Pouso Alegre/MG' },
      { nome: 'Rafael Almeida Prado', fone: '(35) 99205-8122', end: 'Rua Bom Jesus, 304 - Centro, Pouso Alegre/MG' },
      { nome: 'Gabriela Vasconcelos', fone: '(35) 98874-1903', end: 'Av. Prefeito Olavo Gomes de Oliveira, 1400, Pouso Alegre/MG' },
    ];
    const cli = clientes[this.contadorInjecaoDelivery % clientes.length];

    return this.receberPedidoDelivery(plataforma, {
      codigoExterno: codigo,
      cliente: {
        nome: cli.nome,
        telefone: cli.fone,
        endereco: cli.end,
      },
      itens: [
        {
          idProduto: pratoEscolhido?.id ?? 1,
          nome: pratoEscolhido?.nome ?? 'Spaghetti alla Carbonara Tradizionale',
          quantidade: 1,
          precoUnitarioCentavos: pratoEscolhido?.precoCentavos ?? 5890,
        },
      ],
      criadoEm: this.relogio.agora().toISOString(),
    });
  }

  /**
   * Aceite e Impressão Térmica na Cozinha seguindo a sequência da Figura 3 e RN03 (CT09 / CT14):
   * 1. Busca o pedido (`ped: PedidoDelivery`)
   * 2. Notifica a API parceira (iFood / Aiqfome)
   * 3. Invoca `ped.aceitarPedido(impressora)` que instancia o objeto transitório
   *    `via: DocumentoImpressao`, envia os comandos ESC/POS, aguarda a confirmação
   *    física e desaloca `via` (`delete via`).
   * 4. Só assume `EM_PREPARO` se a impressora confirmar fisicamente. Caso esteja sem
   *    bobina de papel, detecta em <= 3s, retém `PENDENTE_IMPRESSAO` e mantém na fila de reimpressão.
   */
  aceitarPedidoDelivery(idInterno: string): ResultadoAceiteDelivery {
    const pedido =
      this.caixa.getPedidos().find((p) => p.getIdInterno() === idInterno) ??
      this.pedidosRepo.buscar(idInterno);
    if (!pedido) throw new DomainError(`Pedido ${idInterno} não encontrado.`);

    const adapter = pedido.getPlataforma() === 'IFOOD' ? this.ifoodAdapter : this.aiqfomeAdapter;
    adapter.confirmarAceiteParceiro(pedido.getCodigoExterno());

    const impresso = pedido.aceitarPedido(this.impressora);
    const resultadoFisico = pedido.getUltimoResultadoImpressao();
    const tempoImpressaoMs = resultadoFisico?.tempoMs ?? 0;
    this.pedidosRepo.atualizar(pedido);

    const usuario = this.auth.getUsuarioAtual()?.getNome() ?? 'operador';
    let alertaErroImpressao: string | null = null;

    if (impresso) {
      this.filaReimpressaoIds.delete(pedido.getIdInterno());
      this.auditRepo.registrar({
        dataHora: this.relogio.agora().toISOString(),
        usuario,
        acao: 'DELIVERY_ACEITO_E_IMPRESSO',
        categoria: 'IMPRESSAO',
        entidadeId: pedido.getIdInterno(),
        detalhes: `Pedido ${pedido.getPlataforma()} #${pedido.getCodigoExterno()} confirmado na impressora 80mm em ${tempoImpressaoMs}ms → status EM_PREPARO.`,
      });
    } else {
      this.filaReimpressaoIds.add(pedido.getIdInterno());
      alertaErroImpressao =
        `RN03: Impressora térmica sem bobina de papel (detectado em ${tempoImpressaoMs}ms <= 3s). ` +
        `Pedido #${pedido.getCodigoExterno()} retido em PENDENTE_IMPRESSAO na fila de reimpressão.`;
      this.auditRepo.registrar({
        dataHora: this.relogio.agora().toISOString(),
        usuario,
        acao: 'IMPRESSORA_SEM_PAPEL_RN03',
        categoria: 'IMPRESSAO',
        entidadeId: pedido.getIdInterno(),
        detalhes: alertaErroImpressao,
      });
    }

    if (this.ultimoPedidoPopup?.getIdInterno() === idInterno) {
      this.ultimoPedidoPopup = null;
    }
    void this.db.persistir();

    return {
      pedido,
      impressoComSucesso: impresso,
      parceiroNotificado: true,
      alertaErroImpressao,
      tempoImpressaoMs,
    };
  }

  /** Reimprime via de cozinha de pedido retido em `PENDENTE_IMPRESSAO` após troca da bobina. */
  reimprimirViaCozinha(idInterno: string): ResultadoAceiteDelivery {
    const pedido =
      this.caixa.getPedidos().find((p) => p.getIdInterno() === idInterno) ??
      this.pedidosRepo.buscar(idInterno);
    if (!pedido) throw new DomainError(`Pedido ${idInterno} não encontrado.`);

    const impresso = pedido.imprimirViaCozinha(this.impressora);
    const resultadoFisico = pedido.getUltimoResultadoImpressao();
    const tempoImpressaoMs = resultadoFisico?.tempoMs ?? 0;
    this.pedidosRepo.atualizar(pedido);

    let alertaErroImpressao: string | null = null;
    if (impresso) {
      this.filaReimpressaoIds.delete(pedido.getIdInterno());
      this.auditRepo.registrar({
        dataHora: this.relogio.agora().toISOString(),
        usuario: this.auth.getUsuarioAtual()?.getNome() ?? 'operador',
        acao: 'DELIVERY_REIMPRESSAO_SUCESSO',
        categoria: 'IMPRESSAO',
        entidadeId: pedido.getIdInterno(),
        detalhes: `Via de cozinha do pedido #${pedido.getCodigoExterno()} reimpressa com sucesso → EM_PREPARO.`,
      });
    } else {
      alertaErroImpressao = `Falha na reimpressão: impressora continua sem bobina de papel (${tempoImpressaoMs}ms).`;
    }

    void this.db.persistir();
    return {
      pedido,
      impressoComSucesso: impresso,
      parceiroNotificado: true,
      alertaErroImpressao,
      tempoImpressaoMs,
    };
  }

  recusarPedidoDelivery(idInterno: string, motivo: string): PedidoDelivery {
    const pedido =
      this.caixa.getPedidos().find((p) => p.getIdInterno() === idInterno) ??
      this.pedidosRepo.buscar(idInterno);
    if (!pedido) throw new DomainError(`Pedido ${idInterno} não encontrado.`);

    pedido.recusarPedido(motivo);
    const adapter = pedido.getPlataforma() === 'IFOOD' ? this.ifoodAdapter : this.aiqfomeAdapter;
    adapter.notificarRecusaParceiro(pedido.getCodigoExterno(), motivo);
    this.pedidosRepo.atualizar(pedido);
    this.filaReimpressaoIds.delete(idInterno);
    if (this.ultimoPedidoPopup?.getIdInterno() === idInterno) {
      this.ultimoPedidoPopup = null;
    }

    this.auditRepo.registrar({
      dataHora: this.relogio.agora().toISOString(),
      usuario: this.auth.getUsuarioAtual()?.getNome() ?? 'operador',
      acao: 'DELIVERY_PEDIDO_RECUSADO',
      categoria: 'DELIVERY',
      entidadeId: pedido.getIdInterno(),
      detalhes: `Pedido #${pedido.getCodigoExterno()} recusado. Motivo: "${motivo}".`,
    });
    void this.db.persistir();
    return pedido;
  }

  concluirPedidoDelivery(idInterno: string): PedidoDelivery {
    const pedido =
      this.caixa.getPedidos().find((p) => p.getIdInterno() === idInterno) ??
      this.pedidosRepo.buscar(idInterno);
    if (!pedido) throw new DomainError(`Pedido ${idInterno} não encontrado.`);
    pedido.concluir();
    this.pedidosRepo.atualizar(pedido);
    void this.db.persistir();
    return pedido;
  }

  dispensarPopupDelivery(): void {
    this.ultimoPedidoPopup = null;
  }

  getUltimoPedidoPopup(): PedidoDelivery | null {
    return this.ultimoPedidoPopup;
  }

  getFilaReimpressao(): PedidoDelivery[] {
    return this.pedidosRepo.listar().filter((p) => p.getStatus() === 'PENDENTE_IMPRESSAO');
  }

  // ───────────────────────── 6. Rotina de Anonimização LGPD (RE01 / CT05) ─────────────────────────

  registrarTelefoneFidelizado(telefone: string): void {
    this.telefonesFidelizados.add(telefone);
  }

  executarRotinaAnonimizacaoLgpd(prazoDias: number = PRAZO_RETENCAO_LGPD_DIAS): ResultadoAnonimizacaoLgpd {
    const agora = this.relogio.agora();
    const politica: PoliticaLgpd = {
      prazoDias,
      telefonesFidelizados: this.telefonesFidelizados,
    };

    const todos = this.pedidosRepo.listar();
    let anonimizados = 0;
    let preservadosPrazoVigente = 0;
    let preservadosFidelizados = 0;
    const idsAnonimizados: string[] = [];

    this.db.transacao(() => {
      for (const p of todos) {
        if (p.isAnonimizadoLgpd()) continue;
        if (this.telefonesFidelizados.has(p.getClienteTelefone())) {
          preservadosFidelizados += 1;
          continue;
        }
        if (prazoLgpdVencido(p, agora, politica)) {
          p.anonimizar();
          this.pedidosRepo.atualizar(p);
          const emCaixa = this.caixa.getPedidos().find((c) => c.getIdInterno() === p.getIdInterno());
          if (emCaixa && !emCaixa.isAnonimizadoLgpd()) emCaixa.anonimizar();
          anonimizados += 1;
          idsAnonimizados.push(p.getIdInterno());
        } else {
          preservadosPrazoVigente += 1;
        }
      }

      this.auditRepo.registrar({
        dataHora: agora.toISOString(),
        usuario: this.auth.getUsuarioAtual()?.getNome() ?? 'LGPD_DPO_JOB',
        acao: 'LGPD_ANONIMIZACAO_RE01',
        categoria: 'LGPD',
        entidadeId: null,
        detalhes: `Rotina LGPD (RE01) executada: ${anonimizados} pedido(s) anonimizado(s), ${preservadosPrazoVigente} dentro do prazo legal (${prazoDias}d), ${preservadosFidelizados} fidelizado(s). Valores fiscais preservados.`,
      });
    });

    void this.db.persistir();
    return {
      avaliados: todos.length,
      anonimizados,
      preservadosPrazoVigente,
      preservadosFidelizados,
      idsAnonimizados,
    };
  }

  // ───────────────────────── 7. Controles de Conectividade WAN e Sincronização ─────────────────────────

  async definirConectividadeWan(online: boolean): Promise<RelatorioSincronizacao | null> {
    this.redeWanOnline = online;
    if (!online) {
      this.caixa.notificarQuedaRede();
      this.auditRepo.registrar({
        dataHora: this.relogio.agora().toISOString(),
        usuario: 'REDE_MONITOR',
        acao: 'QUEDA_CONEXAO_WAN',
        categoria: 'SYNC',
        entidadeId: null,
        detalhes: 'Queda de internet detectada → transição para OperandoOffline.AguardandoVendaOffline.',
      });
      await this.db.persistir();
      return null;
    }

    this.caixa.notificarRedeRestaurada();
    let ultimoRelatorio: RelatorioSincronizacao | null = null;
    this.caixa.configurarPortas({
      sincronizador: async () => {
        ultimoRelatorio = await this.syncWorker.sincronizarTudo();
        await this.db.persistir();
        return ultimoRelatorio.sucesso;
      },
    });
    await this.caixa.sincronizarNuvem();
    return ultimoRelatorio;
  }

  isRedeWanOnline(): boolean {
    return this.redeWanOnline;
  }
}
