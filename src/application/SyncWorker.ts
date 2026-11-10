import {
  RelogioSistema,
  type Caixa,
  type Clock,
  type EventoOutbox,
  type IAuditLogRepository,
  type IOutboxRepository,
  type IVendaRepository,
} from '../domain';
import { ErroConexaoNuvem, type PostgresCloudMock } from '../infrastructure/cloud/PostgresCloudMock';

export const TAMANHO_MAXIMO_LOTE = 100;
export const MAX_TENTATIVAS_LOGICAS = 5;

export interface RelatorioSincronizacao {
  sucesso: boolean;
  lotesEnviados: number;
  eventosConfirmados: number;
  eventosInseridosNuvem: number;
  duplicadosDescartadosNuvem: number;
  quarentenadosDeadLetter: number;
  proximoBackoffSegundos: number | null;
  erro?: string;
}

/**
 * Equação exata de Backoff Exponencial com Jitter (Seção 7.3 da Entrega 1):
 *   t_n = min(2^(n - 1) s + xi_n, 60 s),  onde xi_n ~ U(0, 1 s)
 */
export function calcularBackoffSegundos(
  tentativa: number,
  geradorUniforme01: () => number = Math.random,
): number {
  const n = Math.max(1, Math.floor(tentativa));
  const xi = Math.min(1, Math.max(0, geradorUniforme01()));
  const exponencial = Math.pow(2, n - 1);
  return Math.min(exponencial + xi, 60);
}

export function calcularBackoffMs(
  tentativa: number,
  geradorUniforme01: () => number = Math.random,
): number {
  return Math.round(calcularBackoffSegundos(tentativa, geradorUniforme01) * 1000);
}

/**
 * SyncWorker — Motor de Sincronização Assíncrona e Idempotente SQLite -> PostgreSQL
 * (RF02 / RNF02.1 / RNF02.2 / RN01 / CT08 / CT13).
 */
export class SyncWorker {
  private tentativaRedeAtual = 0;
  private ultimoBackoffSegundos: number | null = null;
  private ultimoLoteConfirmado: EventoOutbox[] = [];
  private readonly alertasDeadLetter: string[] = [];
  private readonly relogio: Clock;
  private readonly geradorJitter: () => number;

  constructor(
    private readonly outboxRepo: IOutboxRepository,
    private readonly vendasRepo: IVendaRepository,
    private readonly auditRepo: IAuditLogRepository,
    private readonly nuvem: PostgresCloudMock,
    private readonly caixa: Caixa,
    opcoes?: { relogio?: Clock; geradorJitter?: () => number },
  ) {
    this.relogio = opcoes?.relogio ?? new RelogioSistema();
    this.geradorJitter = opcoes?.geradorJitter ?? Math.random;
  }

  /**
   * Drena a fila `outbox_events` em lotes atômicos de até 100 eventos em ordem FIFO.
   * Entre cada lote faz `await Promise.resolve()` (cooperative yield) para cumprir a
   * RN01: o recebimento simultâneo de pedidos de delivery nunca é bloqueado (CT08).
   */
  async sincronizarTudo(aoProcessarLote?: (indiceLote: number, lote: EventoOutbox[]) => Promise<void> | void): Promise<RelatorioSincronizacao> {
    let lotesEnviados = 0;
    let eventosConfirmados = 0;
    let eventosInseridosNuvem = 0;
    let duplicadosDescartadosNuvem = 0;
    let quarentenadosDeadLetter = 0;

    while (true) {
      const lote = this.outboxRepo.proximoLote(TAMANHO_MAXIMO_LOTE);
      if (lote.length === 0) break;

      try {
        const res = await this.nuvem.receberLoteAtomico(lote, this.relogio.agora());
        const agoraIso = this.relogio.agora().toISOString();
        this.outboxRepo.marcarSincronizados(res.confirmados, agoraIso);

        const idsVendas = lote
          .filter((e) => e.tipo === 'VENDA_REGISTRADA')
          .map((e) => e.agregadoId);
        if (idsVendas.length > 0) {
          this.vendasRepo.marcarSincronizadas(idsVendas);
          for (const idV of idsVendas) {
            this.caixa.buscarVenda(idV)?.marcarSincronizada();
          }
        }

        this.ultimoLoteConfirmado = lote;
        lotesEnviados += 1;
        eventosConfirmados += res.confirmados.length;
        eventosInseridosNuvem += res.inseridos.length;
        duplicadosDescartadosNuvem += res.duplicadosDescartados.length;
        this.tentativaRedeAtual = 0;
        this.ultimoBackoffSegundos = null;
        this.caixa.atualizarPendencias(this.outboxRepo.contarPendentes());

        if (aoProcessarLote) {
          await aoProcessarLote(lotesEnviados, lote);
        }
        // Cede o event loop para não bloquear webhooks/polling de delivery (RN01)
        await Promise.resolve();
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : String(erro);
        this.tentativaRedeAtual += 1;
        this.ultimoBackoffSegundos = calcularBackoffSegundos(this.tentativaRedeAtual, this.geradorJitter);

        if (erro instanceof ErroConexaoNuvem && erro.tipoFalha === 'ERRO_LOGICO') {
          // Apenas erros lógicos incrementam rumo à Dead-Letter Queue (5 falhas seguidas)
          const quarentenados = this.outboxRepo.registrarFalha(
            lote.map((e) => e.idEvento),
            msg,
            MAX_TENTATIVAS_LOGICAS,
          );
          quarentenadosDeadLetter += quarentenados.length;
          for (const q of quarentenados) {
            const alerta = `DEAD-LETTER: Evento ${q.idEvento} movido para quarentena após ${q.tentativas} falhas lógicas (${msg}).`;
            this.alertasDeadLetter.push(alerta);
            this.auditRepo.registrar({
              dataHora: this.relogio.agora().toISOString(),
              usuario: 'SYNC_WORKER',
              acao: 'OUTBOX_DEAD_LETTER_QUARENTENA',
              categoria: 'SYNC',
              entidadeId: q.idEvento,
              detalhes: alerta,
            });
          }
        } else {
          // Falha de rede / corte Toxiproxy no meio do lote (CT13):
          // a fila permanece PENDENTE e intacta para reenvio posterior sem perda.
          this.auditRepo.registrar({
            dataHora: this.relogio.agora().toISOString(),
            usuario: 'SYNC_WORKER',
            acao: 'SYNC_LOTE_ROLLBACK_REDE',
            categoria: 'SYNC',
            entidadeId: lote[0]?.idEvento ?? null,
            detalhes: `${msg} | Backoff agendado: ${this.ultimoBackoffSegundos.toFixed(2)}s (tentativa #${this.tentativaRedeAtual}).`,
          });
        }

        this.caixa.atualizarPendencias(this.outboxRepo.contarPendentes());
        this.caixa.notificarFalhaSincronizacao('falhaSincronizacao');

        return {
          sucesso: false,
          lotesEnviados,
          eventosConfirmados,
          eventosInseridosNuvem,
          duplicadosDescartadosNuvem,
          quarentenadosDeadLetter,
          proximoBackoffSegundos: this.ultimoBackoffSegundos,
          erro: msg,
        };
      }
    }

    this.caixa.atualizarPendencias(this.outboxRepo.contarPendentes());
    if (lotesEnviados > 0) {
      this.auditRepo.registrar({
        dataHora: this.relogio.agora().toISOString(),
        usuario: 'SYNC_WORKER',
        acao: 'SYNC_CONCLUIDO',
        categoria: 'SYNC',
        entidadeId: null,
        detalhes: `Sincronizados ${eventosConfirmados} evento(s) em ${lotesEnviados} lote(s) (${eventosInseridosNuvem} novos, ${duplicadosDescartadosNuvem} duplicados descartados).`,
      });
    }

    return {
      sucesso: true,
      lotesEnviados,
      eventosConfirmados,
      eventosInseridosNuvem,
      duplicadosDescartadosNuvem,
      quarentenadosDeadLetter,
      proximoBackoffSegundos: null,
    };
  }

  /**
   * Reenvia deliberadamente um lote já confirmado ao PostgreSQL para comprovar a
   * idempotência via UUID v4 (RNF02.2 / CT08).
   */
  async reenviarUltimoLoteConfirmado(): Promise<{
    enviados: number;
    inseridos: number;
    duplicadosDescartados: number;
  }> {
    if (this.ultimoLoteConfirmado.length === 0) {
      return { enviados: 0, inseridos: 0, duplicadosDescartados: 0 };
    }
    const res = await this.nuvem.receberLoteAtomico(this.ultimoLoteConfirmado, this.relogio.agora());
    return {
      enviados: this.ultimoLoteConfirmado.length,
      inseridos: res.inseridos.length,
      duplicadosDescartados: res.duplicadosDescartados.length,
    };
  }

  getUltimoBackoffSegundos(): number | null {
    return this.ultimoBackoffSegundos;
  }

  getTentativaRedeAtual(): number {
    return this.tentativaRedeAtual;
  }

  getAlertasDeadLetter(): readonly string[] {
    return [...this.alertasDeadLetter];
  }
}
