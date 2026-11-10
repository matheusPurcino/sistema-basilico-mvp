import {
  DomainError,
  Gerente,
  ItemVenda,
  OperadorCaixa,
  PedidoDelivery,
  Venda,
  validarProduto,
  type CarrinhoSnapshot,
  type CategoriaProduto,
  type EstadoPersistidoCaixa,
  type EventoCompensatorio,
  type EventoOutbox,
  type IAuditLogRepository,
  type ICaixaRepository,
  type ICarrinhoRepository,
  type IOutboxRepository,
  type IPedidoRepository,
  type IProdutoRepository,
  type IUsuarioRepository,
  type IVendaRepository,
  type ItemVendaSnapshot,
  type MetodoPagamento,
  type NovoEventoOutbox,
  type NovoProduto,
  type Papel,
  type Plataforma,
  type Produto,
  type RegistroAuditoria,
  type RelatorioFechamento,
  type StatusOutbox,
  type StatusPedido,
  type TipoEventoOutbox,
  type Usuario,
  type VerificadorSenha,
} from '../../domain';
import type { SQLiteEngine } from './SQLiteEngine';

/**
 * Repositório Transactional Outbox sobre SQLite (RF02 / CT03 / CT08 / CT13).
 * Suporta injeção de falha de gravação (`definirFalhaForcada`) para comprovar
 * o rollback atômico da venda quando a gravação na Outbox falha (CT03).
 */
export class SqliteOutboxRepository implements IOutboxRepository {
  private falharProximaGravacao = false;

  constructor(private readonly db: SQLiteEngine) {}

  definirFalhaForcada(ativa: boolean): void {
    this.falharProximaGravacao = ativa;
  }

  registrar(evento: NovoEventoOutbox): number {
    if (this.falharProximaGravacao) {
      throw new DomainError('Falha simulada ao gravar evento na tabela outbox_events (teste ACID CT03).');
    }
    const payloadStr = typeof evento.payload === 'string' ? evento.payload : JSON.stringify(evento.payload);
    this.db.executar(
      `INSERT INTO outbox_events (id_evento, tipo, agregado_id, payload, status, tentativas, criado_em)
       VALUES (?, ?, ?, ?, 'PENDENTE', 0, ?)`,
      [evento.idEvento, evento.tipo, evento.agregadoId, payloadStr, evento.criadoEm],
    );
    return this.db.ultimoIdInserido();
  }

  proximoLote(limite = 100): EventoOutbox[] {
    const linhas = this.db.consultar<Record<string, unknown>>(
      `SELECT seq, id_evento, tipo, agregado_id, payload, status, tentativas, ultimo_erro, criado_em, sincronizado_em
       FROM outbox_events
       WHERE status = 'PENDENTE'
       ORDER BY seq ASC
       LIMIT ?`,
      [limite],
    );
    return linhas.map((l) => this.mapear(l));
  }

  marcarSincronizados(ids: string[], em: string): void {
    if (ids.length === 0) return;
    this.db.transacao(() => {
      for (const id of ids) {
        this.db.executar(
          `UPDATE outbox_events SET status = 'SINCRONIZADO', sincronizado_em = ?, ultimo_erro = NULL WHERE id_evento = ?`,
          [em, id],
        );
      }
    });
  }

  registrarFalha(ids: string[], erro: string, maxTentativas = 5): EventoOutbox[] {
    if (ids.length === 0) return [];
    const quarentenados: EventoOutbox[] = [];
    this.db.transacao(() => {
      for (const id of ids) {
        this.db.executar(
          `UPDATE outbox_events
           SET tentativas = tentativas + 1,
               ultimo_erro = ?,
               status = CASE WHEN tentativas + 1 >= ? THEN 'DEAD_LETTER' ELSE 'PENDENTE' END
           WHERE id_evento = ? AND status != 'SINCRONIZADO'`,
          [erro, maxTentativas, id],
        );
        const atualizado = this.db.consultarUm<Record<string, unknown>>(
          `SELECT * FROM outbox_events WHERE id_evento = ?`,
          [id],
        );
        if (atualizado && atualizado.status === 'DEAD_LETTER') {
          quarentenados.push(this.mapear(atualizado));
        }
      }
    });
    return quarentenados;
  }

  contarPendentes(): number {
    const r = this.db.consultarUm<{ total: number }>(
      `SELECT COUNT(*) AS total FROM outbox_events WHERE status = 'PENDENTE'`,
    );
    return Number(r?.total ?? 0);
  }

  listar(limite = 200): EventoOutbox[] {
    return this.db
      .consultar<Record<string, unknown>>(`SELECT * FROM outbox_events ORDER BY seq DESC LIMIT ?`, [limite])
      .map((l) => this.mapear(l));
  }

  listarDeadLetter(): EventoOutbox[] {
    return this.db
      .consultar<Record<string, unknown>>(`SELECT * FROM outbox_events WHERE status = 'DEAD_LETTER' ORDER BY seq ASC`)
      .map((l) => this.mapear(l));
  }

  private mapear(l: Record<string, unknown>): EventoOutbox {
    return {
      seq: Number(l.seq),
      idEvento: String(l.id_evento),
      tipo: String(l.tipo) as TipoEventoOutbox,
      agregadoId: String(l.agregado_id),
      payload: String(l.payload),
      status: String(l.status) as StatusOutbox,
      tentativas: Number(l.tentativas),
      ultimoErro: l.ultimo_erro != null ? String(l.ultimo_erro) : null,
      criadoEm: String(l.criado_em),
      sincronizadoEm: l.sincronizado_em != null ? String(l.sincronizado_em) : null,
    };
  }
}

export class SqliteProdutoRepository implements IProdutoRepository {
  constructor(private readonly db: SQLiteEngine) {}

  listar(incluirInativos = false): Produto[] {
    const sql = incluirInativos
      ? `SELECT * FROM produtos ORDER BY categoria ASC, nome ASC`
      : `SELECT * FROM produtos WHERE ativo = 1 ORDER BY categoria ASC, nome ASC`;
    return this.db.consultar<Record<string, unknown>>(sql).map((l) => this.mapear(l));
  }

  buscar(id: number): Produto | undefined {
    const l = this.db.consultarUm<Record<string, unknown>>(`SELECT * FROM produtos WHERE id = ?`, [id]);
    return l ? this.mapear(l) : undefined;
  }

  criar(novo: NovoProduto): Produto {
    const validado = validarProduto(novo);
    let id = 0;
    this.db.transacao(() => {
      this.db.executar(
        `INSERT INTO produtos (nome, descricao, categoria, preco_centavos, ativo) VALUES (?, ?, ?, ?, ?)`,
        [validado.nome, validado.descricao, validado.categoria, validado.precoCentavos, validado.ativo ? 1 : 0],
      );
      id = this.db.ultimoIdInserido();
    });
    return { id, ...validado };
  }

  atualizar(p: Produto): void {
    const validado = validarProduto(p);
    this.db.executar(
      `UPDATE produtos SET nome = ?, descricao = ?, categoria = ?, preco_centavos = ?, ativo = ? WHERE id = ?`,
      [validado.nome, validado.descricao, validado.categoria, validado.precoCentavos, validado.ativo ? 1 : 0, p.id],
    );
  }

  remover(id: number): void {
    this.db.executar(`DELETE FROM produtos WHERE id = ?`, [id]);
  }

  contar(): number {
    return Number(this.db.consultarUm<{ total: number }>(`SELECT COUNT(*) AS total FROM produtos`)?.total ?? 0);
  }

  private mapear(l: Record<string, unknown>): Produto {
    return {
      id: Number(l.id),
      nome: String(l.nome),
      descricao: String(l.descricao ?? ''),
      categoria: String(l.categoria) as CategoriaProduto,
      precoCentavos: Number(l.preco_centavos),
      ativo: Number(l.ativo) === 1,
    };
  }
}

export class SqliteVendaRepository implements IVendaRepository {
  constructor(private readonly db: SQLiteEngine) {}

  salvar(venda: Venda): void {
    const s = venda.toSnapshot();
    if (!s.metodoPagamento) throw new DomainError('Venda precisa ter método de pagamento definido.');
    this.db.transacao(() => {
      this.db.executar(
        `INSERT INTO vendas (id_venda, numero_sequencial, data_hora, valor_total_centavos, desconto_centavos, metodo_pagamento, sincronizado, estornada, operador)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          s.idVenda,
          s.numeroSequencial,
          s.dataHora,
          s.valorTotalCentavos,
          s.descontoCentavos,
          s.metodoPagamento,
          s.sincronizado ? 1 : 0,
          s.estornada ? 1 : 0,
          s.operador ?? null,
        ],
      );
      for (const item of s.itens) {
        this.db.executar(
          `INSERT INTO itens_venda (id_venda, id_produto, nome_produto, quantidade, preco_unitario_centavos)
           VALUES (?, ?, ?, ?, ?)`,
          [s.idVenda, item.idProduto, item.nomeProduto, item.quantidade, item.precoUnitarioCentavos],
        );
      }
    });
  }

  marcarEstornada(idVenda: string): void {
    this.db.executar(`UPDATE vendas SET estornada = 1 WHERE id_venda = ?`, [idVenda]);
  }

  marcarSincronizadas(idsVenda: string[]): void {
    if (idsVenda.length === 0) return;
    this.db.transacao(() => {
      for (const id of idsVenda) {
        this.db.executar(`UPDATE vendas SET sincronizado = 1 WHERE id_venda = ?`, [id]);
      }
    });
  }

  proximoNumeroSequencial(): number {
    const r = this.db.consultarUm<{ maxSeq: number | null }>(
      `SELECT MAX(numero_sequencial) AS maxSeq FROM vendas`,
    );
    return Number(r?.maxSeq ?? 0) + 1;
  }

  listar(): Venda[] {
    const vendasRaw = this.db.consultar<Record<string, unknown>>(
      `SELECT * FROM vendas ORDER BY numero_sequencial DESC`,
    );
    return vendasRaw.map((v) => this.hidratar(v));
  }

  buscar(idVenda: string): Venda | undefined {
    const v = this.db.consultarUm<Record<string, unknown>>(`SELECT * FROM vendas WHERE id_venda = ?`, [idVenda]);
    return v ? this.hidratar(v) : undefined;
  }

  salvarEventoCompensatorio(e: EventoCompensatorio): void {
    this.db.executar(
      `INSERT INTO eventos_compensatorios (id_evento, id_venda_original, numero_venda_original, motivo, valor_estornado_centavos, autorizado_por, data_hora)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        e.idEvento,
        e.idVendaOriginal,
        e.numeroVendaOriginal,
        e.motivo,
        e.valorEstornadoCentavos,
        e.autorizadoPor,
        e.dataHora,
      ],
    );
  }

  listarEventosCompensatorios(): EventoCompensatorio[] {
    return this.db
      .consultar<Record<string, unknown>>(`SELECT * FROM eventos_compensatorios ORDER BY data_hora DESC`)
      .map((l) => ({
        idEvento: String(l.id_evento),
        idVendaOriginal: String(l.id_venda_original),
        numeroVendaOriginal: Number(l.numero_venda_original),
        motivo: String(l.motivo),
        valorEstornadoCentavos: Number(l.valor_estornado_centavos),
        autorizadoPor: String(l.autorizado_por),
        dataHora: String(l.data_hora),
      }));
  }

  contar(): number {
    return Number(this.db.consultarUm<{ total: number }>(`SELECT COUNT(*) AS total FROM vendas`)?.total ?? 0);
  }

  private hidratar(v: Record<string, unknown>): Venda {
    const idVenda = String(v.id_venda);
    const itensRaw = this.db.consultar<Record<string, unknown>>(
      `SELECT * FROM itens_venda WHERE id_venda = ? ORDER BY id ASC`,
      [idVenda],
    );
    const itens: ItemVendaSnapshot[] = itensRaw.map((i) => ({
      idProduto: Number(i.id_produto),
      nomeProduto: String(i.nome_produto),
      quantidade: Number(i.quantidade),
      precoUnitarioCentavos: Number(i.preco_unitario_centavos),
    }));
    return Venda.fromSnapshot({
      idVenda,
      numeroSequencial: Number(v.numero_sequencial),
      dataHora: String(v.data_hora),
      valorTotalCentavos: Number(v.valor_total_centavos),
      descontoCentavos: Number(v.desconto_centavos),
      metodoPagamento: String(v.metodo_pagamento) as MetodoPagamento,
      sincronizado: Number(v.sincronizado) === 1,
      estornada: Number(v.estornada) === 1,
      itens,
      operador: v.operador != null ? String(v.operador) : undefined,
    });
  }
}

export class SqlitePedidoRepository implements IPedidoRepository {
  constructor(private readonly db: SQLiteEngine) {}

  inserir(p: PedidoDelivery): void {
    const s = p.toSnapshot();
    this.db.executar(
      `INSERT INTO pedidos_delivery
       (id_interno, codigo_externo, plataforma, cliente_nome, cliente_telefone, cliente_endereco, itens_json, valor_total_centavos, status, data_criacao, anonimizado_lgpd, motivo_recusa, tentativas_impressao)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.idInterno,
        s.codigoExterno,
        s.plataforma,
        s.clienteNome,
        s.clienteTelefone,
        s.clienteEndereco,
        JSON.stringify(s.itens),
        s.valorTotalCentavos,
        s.status,
        s.dataCriacao,
        s.anonimizadoLgpd ? 1 : 0,
        s.motivoRecusa ?? null,
        s.tentativasImpressao ?? 0,
      ],
    );
  }

  atualizar(p: PedidoDelivery): void {
    const s = p.toSnapshot();
    this.db.executar(
      `UPDATE pedidos_delivery
       SET cliente_nome = ?, cliente_telefone = ?, cliente_endereco = ?, status = ?, anonimizado_lgpd = ?, motivo_recusa = ?, tentativas_impressao = ?
       WHERE id_interno = ?`,
      [
        s.clienteNome,
        s.clienteTelefone,
        s.clienteEndereco,
        s.status,
        s.anonimizadoLgpd ? 1 : 0,
        s.motivoRecusa ?? null,
        s.tentativasImpressao ?? 0,
        s.idInterno,
      ],
    );
  }

  existeCodigoExterno(plataforma: Plataforma, codigo: string): boolean {
    const r = this.db.consultarUm<{ total: number }>(
      `SELECT COUNT(*) AS total FROM pedidos_delivery WHERE plataforma = ? AND codigo_externo = ?`,
      [plataforma, codigo],
    );
    return Number(r?.total ?? 0) > 0;
  }

  buscar(idInterno: string): PedidoDelivery | undefined {
    const l = this.db.consultarUm<Record<string, unknown>>(
      `SELECT * FROM pedidos_delivery WHERE id_interno = ?`,
      [idInterno],
    );
    return l ? this.mapear(l) : undefined;
  }

  listar(): PedidoDelivery[] {
    return this.db
      .consultar<Record<string, unknown>>(`SELECT * FROM pedidos_delivery ORDER BY data_criacao DESC`)
      .map((l) => this.mapear(l));
  }

  private mapear(l: Record<string, unknown>): PedidoDelivery {
    const itens = (JSON.parse(String(l.itens_json)) as ItemVendaSnapshot[]).map((i) =>
      ItemVenda.fromSnapshot(i).toSnapshot(),
    );
    return PedidoDelivery.fromSnapshot({
      idInterno: String(l.id_interno),
      codigoExterno: String(l.codigo_externo),
      plataforma: String(l.plataforma) as Plataforma,
      clienteNome: String(l.cliente_nome),
      clienteTelefone: String(l.cliente_telefone),
      clienteEndereco: String(l.cliente_endereco),
      itens,
      valorTotalCentavos: Number(l.valor_total_centavos),
      status: String(l.status) as StatusPedido,
      dataCriacao: String(l.data_criacao),
      anonimizadoLgpd: Number(l.anonimizado_lgpd) === 1,
      motivoRecusa: l.motivo_recusa != null ? String(l.motivo_recusa) : null,
      tentativasImpressao: Number(l.tentativas_impressao ?? 0),
    });
  }
}

export class SqliteAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: SQLiteEngine) {}

  registrar(r: Omit<RegistroAuditoria, 'id'>): void {
    this.db.executar(
      `INSERT INTO audit_logs (data_hora, usuario, acao, categoria, entidade_id, detalhes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [r.dataHora, r.usuario, r.acao, r.categoria, r.entidadeId, r.detalhes],
    );
  }

  listar(limite = 200): RegistroAuditoria[] {
    return this.db
      .consultar<Record<string, unknown>>(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?`, [limite])
      .map((l) => ({
        id: Number(l.id),
        dataHora: String(l.data_hora),
        usuario: String(l.usuario),
        acao: String(l.acao),
        categoria: String(l.categoria) as RegistroAuditoria['categoria'],
        entidadeId: l.entidade_id != null ? String(l.entidade_id) : null,
        detalhes: String(l.detalhes),
      }));
  }
}

export class SqliteCarrinhoRepository implements ICarrinhoRepository {
  constructor(private readonly db: SQLiteEngine) {}

  salvar(c: CarrinhoSnapshot, em: string): void {
    this.db.executar(
      `INSERT INTO carrinho_aberto (id, itens_json, desconto_centavos, atualizado_em)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET itens_json = excluded.itens_json, desconto_centavos = excluded.desconto_centavos, atualizado_em = excluded.atualizado_em`,
      [JSON.stringify(c.itens), c.descontoCentavos, em],
    );
  }

  carregar(): CarrinhoSnapshot | null {
    const l = this.db.consultarUm<Record<string, unknown>>(`SELECT * FROM carrinho_aberto WHERE id = 1`);
    if (!l) return null;
    const itens = JSON.parse(String(l.itens_json)) as ItemVendaSnapshot[];
    if (itens.length === 0 && Number(l.desconto_centavos) === 0) return null;
    return {
      itens,
      descontoCentavos: Number(l.desconto_centavos),
    };
  }

  limpar(): void {
    this.db.executar(`DELETE FROM carrinho_aberto WHERE id = 1`);
  }
}

export class SqliteUsuarioRepository implements IUsuarioRepository {
  constructor(
    private readonly db: SQLiteEngine,
    private readonly verificador: VerificadorSenha,
  ) {}

  buscarTodos(): Usuario[] {
    return this.db
      .consultar<Record<string, unknown>>(`SELECT * FROM usuarios ORDER BY id ASC`)
      .map((l) => this.instanciar(l));
  }

  buscarPorLogin(nomeOuEmail: string): Usuario | undefined {
    const alvo = nomeOuEmail.trim().toLowerCase();
    const l = this.db.consultarUm<Record<string, unknown>>(
      `SELECT * FROM usuarios WHERE LOWER(nome) = ? OR LOWER(email) = ?`,
      [alvo, alvo],
    );
    return l ? this.instanciar(l) : undefined;
  }

  inserir(dados: { nome: string; email: string; senhaHash: string; papel: Papel }): void {
    this.db.executar(
      `INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, ?)`,
      [dados.nome, dados.email, dados.senhaHash, dados.papel],
    );
  }

  contar(): number {
    return Number(this.db.consultarUm<{ total: number }>(`SELECT COUNT(*) AS total FROM usuarios`)?.total ?? 0);
  }

  private instanciar(l: Record<string, unknown>): Usuario {
    const dados = {
      id: Number(l.id),
      nome: String(l.nome),
      email: String(l.email),
      senhaHash: String(l.senha_hash),
    };
    const papel = String(l.papel) as Papel;
    return papel === 'GERENTE'
      ? new Gerente(dados, this.verificador)
      : new OperadorCaixa(dados, this.verificador);
  }
}

export class SqliteCaixaRepository implements ICaixaRepository {
  constructor(private readonly db: SQLiteEngine) {}

  salvarEstado(e: EstadoPersistidoCaixa): void {
    this.db.executar(
      `INSERT INTO caixa_estado (id, aberto, saldo_inicial_centavos, saldo_local_centavos, aberto_em, operador_abertura)
       VALUES (1, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         aberto = excluded.aberto,
         saldo_inicial_centavos = excluded.saldo_inicial_centavos,
         saldo_local_centavos = excluded.saldo_local_centavos,
         aberto_em = excluded.aberto_em,
         operador_abertura = excluded.operador_abertura`,
      [e.aberto ? 1 : 0, e.saldoInicialCentavos, e.saldoLocalCentavos, e.abertoEm, e.operadorAbertura],
    );
  }

  carregarEstado(): EstadoPersistidoCaixa | null {
    const l = this.db.consultarUm<Record<string, unknown>>(`SELECT * FROM caixa_estado WHERE id = 1`);
    if (!l) return null;
    return {
      aberto: Number(l.aberto) === 1,
      saldoInicialCentavos: Number(l.saldo_inicial_centavos),
      saldoLocalCentavos: Number(l.saldo_local_centavos),
      abertoEm: l.aberto_em != null ? String(l.aberto_em) : null,
      operadorAbertura: l.operador_abertura != null ? String(l.operador_abertura) : null,
    };
  }

  salvarFechamento(r: RelatorioFechamento): void {
    this.db.executar(
      `INSERT INTO fechamentos_caixa (id_fechamento, fechado_em, relatorio_json) VALUES (?, ?, ?)`,
      [r.idFechamento, r.fechadoEm, JSON.stringify(r)],
    );
  }

  listarFechamentos(): RelatorioFechamento[] {
    return this.db
      .consultar<Record<string, unknown>>(`SELECT * FROM fechamentos_caixa ORDER BY fechado_em DESC`)
      .map((l) => JSON.parse(String(l.relatorio_json)) as RelatorioFechamento);
  }
}
