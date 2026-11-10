import { RelogioSistema, type Clock } from '../shared/Clock';
import { CaixaFechadoError, DomainError } from '../shared/errors';
import { assertCentavosNaoNegativos, type Centavos } from '../shared/Money';
import { gerarUuidV4 } from '../shared/uuid';
import type { PedidoDelivery } from './PedidoDelivery';
import type { EventoCompensatorio, RelatorioFechamento } from './ValueObjects';
import { METODOS_PAGAMENTO, type MetodoPagamento, type Venda } from './Venda';

/** Estados da Máquina de Estados do Caixa (Figura 4). */
export type EstadoMaquina = 'OperandoOnline' | 'OperandoOffline' | 'Sincronizando';
export type SubEstadoOffline = 'AguardandoVendaOffline' | 'GravandoLocal' | null;

export interface TransicaoEstado {
  readonly de: string;
  readonly para: string;
  readonly evento: string;
  readonly em: string;
}

export interface PortasCaixa {
  /** Sonda de conectividade WAN (injetada pela infraestrutura). */
  monitorRede?: () => boolean;
  /** Motor de sincronização (SyncWorker) — retorna `true` se esvaziou a fila. */
  sincronizador?: () => Promise<boolean>;
  relogio?: Clock;
}

export interface EstadoPersistidoCaixa {
  aberto: boolean;
  saldoInicialCentavos: number;
  saldoLocalCentavos: number;
  abertoEm: string | null;
  operadorAbertura: string | null;
}

/**
 * Caixa (Figura 2) — agrega Venda[] e PedidoDelivery[] e implementa a
 * Máquina de Estados da Figura 4:
 *
 *   OperandoOnline ──quedaRede──▶ OperandoOffline[AguardandoVendaOffline ⇄ GravandoLocal]
 *   OperandoOffline ──redeRestaurada──▶ Sincronizando ──sucesso──▶ OperandoOnline
 *                                        Sincronizando ──falha───▶ OperandoOffline
 */
export class Caixa {
  private aberto = false;
  private statusConexao = true;
  private estadoMaquina: EstadoMaquina = 'OperandoOnline';
  private subEstadoOffline: SubEstadoOffline = null;
  private saldoLocalCentavos: Centavos = 0;

  private saldoInicialCentavos: Centavos = 0;
  private abertoEm: Date | null = null;
  private operadorAbertura: string | null = null;
  private vendas: Venda[] = [];
  private pedidos: PedidoDelivery[] = [];
  private eventosCompensatorios: EventoCompensatorio[] = [];
  private pendenciasSincronizacao = 0;
  private historico: TransicaoEstado[] = [];
  private portas: PortasCaixa;
  private sincronizacaoEmCurso: Promise<boolean> | null = null;
  private ouvintes = new Set<(estado: EstadoMaquina, sub: SubEstadoOffline) => void>();

  constructor(portas: PortasCaixa = {}) {
    this.portas = { relogio: new RelogioSistema(), ...portas };
  }

  configurarPortas(portas: PortasCaixa): void {
    this.portas = { ...this.portas, ...portas };
  }

  aoMudarEstado(cb: (estado: EstadoMaquina, sub: SubEstadoOffline) => void): () => void {
    this.ouvintes.add(cb);
    return () => this.ouvintes.delete(cb);
  }

  private agora(): Date {
    return this.portas.relogio!.agora();
  }

  private mudarEstado(estado: EstadoMaquina, sub: SubEstadoOffline, evento: string): void {
    const de = this.rotuloEstado();
    this.estadoMaquina = estado;
    this.subEstadoOffline = sub;
    const para = this.rotuloEstado();
    if (de !== para) {
      this.historico.push({ de, para, evento, em: this.agora().toISOString() });
      if (this.historico.length > 200) this.historico.shift();
      this.ouvintes.forEach((cb) => cb(this.estadoMaquina, this.subEstadoOffline));
    }
  }

  rotuloEstado(): string {
    return this.subEstadoOffline ? `${this.estadoMaquina}.${this.subEstadoOffline}` : this.estadoMaquina;
  }

  // ───────────────────────── Gestão de turno ─────────────────────────

  abrir(saldoInicialCentavos: number, operador: string): void {
    assertCentavosNaoNegativos(saldoInicialCentavos, 'saldo inicial');
    if (this.aberto) throw new DomainError('O caixa já está aberto.');
    this.aberto = true;
    this.saldoInicialCentavos = saldoInicialCentavos;
    this.saldoLocalCentavos = saldoInicialCentavos;
    this.abertoEm = this.agora();
    this.operadorAbertura = operador;
  }

  /** Chamado por `OperadorCaixa.fecharCaixa()` — aplica a RN04. */
  fechar(operador: string): RelatorioFechamento {
    if (!this.aberto || !this.abertoEm) throw new CaixaFechadoError();
    const inicioTurno = this.abertoEm.getTime();
    const doTurno = this.vendas.filter((v) => v.getDataHora().getTime() >= inicioTurno);
    const estornadas = doTurno.filter((v) => v.isEstornada());
    const totaisPorMetodo = Object.fromEntries(METODOS_PAGAMENTO.map((m) => [m, 0])) as Record<MetodoPagamento, number>;
    for (const v of doTurno) {
      const metodo = v.getMetodoPagamento();
      if (metodo && !v.isEstornada()) totaisPorMetodo[metodo] += v.getValorTotalCentavos();
    }
    const modo = this.statusConexao && this.estadoMaquina !== 'OperandoOffline' ? 'ONLINE' : 'OFFLINE';
    const ressalvas: string[] = [];
    const pendencias = this.pendenciasSincronizacao;
    if (pendencias > 0) {
      ressalvas.push(
        `RN04: ${pendencias} evento(s) pendente(s) na Outbox local ainda não sincronizado(s) com a nuvem. ` +
          'A fila foi preservada e será enviada no próximo ciclo online.',
      );
    }
    if (modo === 'OFFLINE') ressalvas.push('Fechamento realizado em modo OFFLINE (sem conexão WAN).');

    const relatorio: RelatorioFechamento = Object.freeze({
      idFechamento: gerarUuidV4(),
      operador,
      abertoEm: this.abertoEm.toISOString(),
      fechadoEm: this.agora().toISOString(),
      modo,
      saldoInicialCentavos: this.saldoInicialCentavos,
      totalVendasBrutoCentavos: doTurno.reduce((a, v) => a + v.getValorTotalCentavos(), 0),
      totalEstornosCentavos: estornadas.reduce((a, v) => a + v.getValorTotalCentavos(), 0),
      saldoFinalCentavos: this.saldoLocalCentavos,
      quantidadeVendas: doTurno.length,
      quantidadeEstornos: estornadas.length,
      totaisPorMetodo: Object.freeze(totaisPorMetodo),
      pendenciasOutbox: pendencias,
      alertaPendencia: pendencias > 0,
      ressalvas: Object.freeze(ressalvas),
    });
    this.aberto = false;
    this.abertoEm = null;
    this.operadorAbertura = null;
    return relatorio;
  }

  registrarVenda(venda: Venda): void {
    if (!this.aberto) throw new CaixaFechadoError();
    if (!venda.getMetodoPagamento()) throw new DomainError('Venda sem pagamento registrado.');
    this.vendas.push(venda);
    this.saldoLocalCentavos += venda.getValorTotalCentavos();
  }

  registrarEstorno(evento: EventoCompensatorio): void {
    this.eventosCompensatorios.push(evento);
    const venda = this.buscarVenda(evento.idVendaOriginal);
    if (this.aberto && this.abertoEm && venda && venda.getDataHora().getTime() >= this.abertoEm.getTime()) {
      this.saldoLocalCentavos -= evento.valorEstornadoCentavos;
    }
  }

  adicionarPedido(pedido: PedidoDelivery): void {
    if (!this.pedidos.some((p) => p.getIdInterno() === pedido.getIdInterno())) this.pedidos.push(pedido);
  }

  buscarVenda(idVenda: string): Venda | undefined {
    return this.vendas.find((v) => v.getIdVenda() === idVenda);
  }

  atualizarPendencias(quantidade: number): void {
    this.pendenciasSincronizacao = Math.max(0, quantidade);
  }

  /** Reidrata o agregado a partir do SQLite após reinício (RTO ≤ 2 min). */
  restaurar(estado: EstadoPersistidoCaixa, vendas: Venda[], eventos: EventoCompensatorio[]): void {
    this.aberto = estado.aberto;
    this.saldoInicialCentavos = estado.saldoInicialCentavos;
    this.saldoLocalCentavos = estado.saldoLocalCentavos;
    this.abertoEm = estado.abertoEm ? new Date(estado.abertoEm) : null;
    this.operadorAbertura = estado.operadorAbertura;
    this.vendas = [...vendas];
    this.eventosCompensatorios = [...eventos];
  }

  exportarEstado(): EstadoPersistidoCaixa {
    return {
      aberto: this.aberto,
      saldoInicialCentavos: this.saldoInicialCentavos,
      saldoLocalCentavos: this.saldoLocalCentavos,
      abertoEm: this.abertoEm?.toISOString() ?? null,
      operadorAbertura: this.operadorAbertura,
    };
  }

  // ───────────────────────── Máquina de Estados ─────────────────────────

  /** Consulta a sonda de rede e dispara as transições correspondentes. */
  verificarStatusRede(): boolean {
    const online = this.portas.monitorRede ? this.portas.monitorRede() : this.statusConexao;
    if (!online && this.statusConexao) this.notificarQuedaRede();
    else if (online && !this.statusConexao) this.notificarRedeRestaurada();
    return this.statusConexao;
  }

  notificarQuedaRede(): void {
    this.statusConexao = false;
    if (this.estadoMaquina !== 'OperandoOffline') {
      this.mudarEstado('OperandoOffline', 'AguardandoVendaOffline', 'quedaDeRede');
    }
  }

  /** A rede voltou: a sincronização deve ser disparada pela aplicação (RN01). */
  notificarRedeRestaurada(): void {
    this.statusConexao = true;
  }

  /** Falha durante o envio de lote (ex.: Toxiproxy corta a conexão — CT13). */
  notificarFalhaSincronizacao(motivo = 'falhaSincronizacao'): void {
    this.mudarEstado('OperandoOffline', 'AguardandoVendaOffline', motivo);
  }

  iniciarGravacaoLocal(): void {
    if (this.estadoMaquina === 'OperandoOffline') {
      this.mudarEstado('OperandoOffline', 'GravandoLocal', 'registrarVendaOffline');
    }
  }

  concluirGravacaoLocal(): void {
    if (this.estadoMaquina === 'OperandoOffline' && this.subEstadoOffline === 'GravandoLocal') {
      this.mudarEstado('OperandoOffline', 'AguardandoVendaOffline', 'vendaGravadaLocalmente');
    }
  }

  /**
   * OperandoOffline/Online → Sincronizando → (OperandoOnline | OperandoOffline).
   * Chamadas concorrentes reaproveitam a mesma sincronização em curso.
   */
  sincronizarNuvem(): Promise<boolean> {
    if (this.sincronizacaoEmCurso) return this.sincronizacaoEmCurso;
    const executar = async (): Promise<boolean> => {
      if (!this.verificarStatusRede()) return false;
      this.mudarEstado('Sincronizando', null, 'redeRestaurada/iniciarSync');
      let sucesso = false;
      try {
        sucesso = this.portas.sincronizador ? await this.portas.sincronizador() : true;
      } catch {
        sucesso = false;
      }
      if (sucesso && this.statusConexao) {
        this.mudarEstado('OperandoOnline', null, 'syncConcluido');
        return true;
      }
      this.mudarEstado('OperandoOffline', 'AguardandoVendaOffline', 'syncFalhou');
      return false;
    };
    this.sincronizacaoEmCurso = executar().finally(() => {
      this.sincronizacaoEmCurso = null;
    });
    return this.sincronizacaoEmCurso;
  }

  // ───────────────────────── Getters ─────────────────────────
  isAberto(): boolean {
    return this.aberto;
  }
  getStatusConexao(): boolean {
    return this.statusConexao;
  }
  getEstadoMaquina(): EstadoMaquina {
    return this.estadoMaquina;
  }
  getSubEstadoOffline(): SubEstadoOffline {
    return this.subEstadoOffline;
  }
  getSaldoLocalCentavos(): Centavos {
    return this.saldoLocalCentavos;
  }
  getSaldoInicialCentavos(): Centavos {
    return this.saldoInicialCentavos;
  }
  getAbertoEm(): Date | null {
    return this.abertoEm ? new Date(this.abertoEm.getTime()) : null;
  }
  getOperadorAbertura(): string | null {
    return this.operadorAbertura;
  }
  getVendas(): readonly Venda[] {
    return [...this.vendas];
  }
  getPedidos(): readonly PedidoDelivery[] {
    return [...this.pedidos];
  }
  getEventosCompensatorios(): readonly EventoCompensatorio[] {
    return [...this.eventosCompensatorios];
  }
  getPendenciasSincronizacao(): number {
    return this.pendenciasSincronizacao;
  }
  getHistoricoEstados(): readonly TransicaoEstado[] {
    return [...this.historico];
  }
}
