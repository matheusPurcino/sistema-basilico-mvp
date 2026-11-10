import { isUuidV4, type EventoOutbox, type TipoEventoOutbox } from '../../domain';
import type { KeyValueStorage } from '../persistence/KeyValueStorage';

export interface TransacaoNuvem {
  idEvento: string;
  seqOrigem: number;
  tipo: TipoEventoOutbox;
  agregadoId: string;
  payload: string;
  recebidoEm: string;
}

export interface ResultadoLoteNuvem {
  confirmados: string[];
  inseridos: string[];
  duplicadosDescartados: string[];
  totalNaNuvem: number;
}

export class ErroConexaoNuvem extends Error {
  constructor(
    mensagem: string,
    readonly codigoHttp: number = 503,
    readonly tipoFalha: 'REDE_CORTADA_MEIO_LOTE' | 'HTTP_503' | 'TIMEOUT' | 'ERRO_LOGICO' = 'HTTP_503',
  ) {
    super(mensagem);
    this.name = 'ErroConexaoNuvem';
  }
}

/**
 * PostgresCloudMock — Simulador do PostgreSQL Central em Nuvem (RF02 / RNF02.2 / CT08 / CT13).
 *
 * Implementa:
 * 1. Controle transacional atômico por lote (`BEGIN ... COMMIT / ROLLBACK`).
 * 2. Deduplicação idempotente por `UUID v4` (`UNIQUE (id_evento)` — semântica *effectively-once*).
 * 3. Injeção de Caos (Toxiproxy): corte de conexão no meio do lote com rollback integral
 *    da transação remota (CT13), além de falhas HTTP 503 / Timeout.
 */
export class PostgresCloudMock {
  private readonly transacoes = new Map<string, TransacaoNuvem>();
  private cortarNoMeioDoLote = false;
  private forcarHttp503 = false;
  private readonly idsInvalidos = new Set<string>();
  private rollbacksRealizados = 0;
  private lotesProcessados = 0;
  private duplicatasDescartadasTotal = 0;
  private readonly chaveStorage = 'basilico.cloud.pg_transactions';

  constructor(private readonly storage?: KeyValueStorage) {
    this.restaurarDoStorage();
  }

  private restaurarDoStorage(): void {
    if (!this.storage) return;
    const raw = this.storage.getItem(this.chaveStorage);
    if (!raw) return;
    try {
      const lista = JSON.parse(raw) as TransacaoNuvem[];
      for (const t of lista) this.transacoes.set(t.idEvento, t);
    } catch {
      /* ignora storage inválido */
    }
  }

  private salvarNoStorage(): void {
    if (!this.storage) return;
    this.storage.setItem(this.chaveStorage, JSON.stringify([...this.transacoes.values()]));
  }

  // ───────────────────────── Controles de Caos (Toxiproxy) ─────────────────────────

  definirCorteMeioDoLote(ativo: boolean): void {
    this.cortarNoMeioDoLote = ativo;
  }

  isCorteMeioDoLoteAtivo(): boolean {
    return this.cortarNoMeioDoLote;
  }

  definirHttp503(ativo: boolean): void {
    this.forcarHttp503 = ativo;
  }

  isHttp503Ativo(): boolean {
    return this.forcarHttp503;
  }

  marcarEventoComErroLogico(idEvento: string): void {
    this.idsInvalidos.add(idEvento);
  }

  limparErrosLogicos(): void {
    this.idsInvalidos.clear();
  }

  // ───────────────────────── Recebimento Atômico de Lote ─────────────────────────

  async receberLoteAtomico(eventos: readonly EventoOutbox[], agora: Date = new Date()): Promise<ResultadoLoteNuvem> {
    if (this.forcarHttp503) {
      throw new ErroConexaoNuvem('PostgreSQL Cloud Gateway: HTTP 503 Service Unavailable', 503, 'HTTP_503');
    }
    if (eventos.length === 0) {
      return {
        confirmados: [],
        inseridos: [],
        duplicadosDescartados: [],
        totalNaNuvem: this.transacoes.size,
      };
    }

    // Snapshot transacional (BEGIN)
    const staging = new Map<string, TransacaoNuvem>(this.transacoes);
    const confirmados: string[] = [];
    const inseridos: string[] = [];
    const duplicadosDescartados: string[] = [];
    const pontoDeCorte = Math.max(1, Math.floor(eventos.length / 2));

    for (let i = 0; i < eventos.length; i++) {
      // Simulação Toxiproxy: corta a conexão TCP exatamente no meio do lote (CT13)
      if (this.cortarNoMeioDoLote && i === pontoDeCorte) {
        // ROLLBACK integral: descarta `staging` sem tocar em `this.transacoes`
        this.rollbacksRealizados += 1;
        throw new ErroConexaoNuvem(
          `Toxiproxy: conexão TCP resetada após ${i}/${eventos.length} eventos — ROLLBACK integral executado no PostgreSQL.`,
          503,
          'REDE_CORTADA_MEIO_LOTE',
        );
      }

      const ev = eventos[i];
      if (!isUuidV4(ev.idEvento) || this.idsInvalidos.has(ev.idEvento)) {
        this.rollbacksRealizados += 1;
        throw new ErroConexaoNuvem(
          `Erro lógico de validação no evento ${ev.idEvento}: payload ou UUID inválido.`,
          422,
          'ERRO_LOGICO',
        );
      }

      confirmados.push(ev.idEvento);
      if (staging.has(ev.idEvento)) {
        // Idempotência (RNF02.2 / CT08): ON CONFLICT (id_evento) DO NOTHING
        duplicadosDescartados.push(ev.idEvento);
      } else {
        staging.set(ev.idEvento, {
          idEvento: ev.idEvento,
          seqOrigem: ev.seq,
          tipo: ev.tipo,
          agregadoId: ev.agregadoId,
          payload: ev.payload,
          recebidoEm: agora.toISOString(),
        });
        inseridos.push(ev.idEvento);
      }
    }

    // COMMIT atômico
    this.transacoes.clear();
    for (const [k, v] of staging) this.transacoes.set(k, v);
    this.lotesProcessados += 1;
    this.duplicatasDescartadasTotal += duplicadosDescartados.length;
    this.salvarNoStorage();

    return {
      confirmados,
      inseridos,
      duplicadosDescartados,
      totalNaNuvem: this.transacoes.size,
    };
  }

  // ───────────────────────── Consultas e Métricas ─────────────────────────

  listarTransacoes(): TransacaoNuvem[] {
    return [...this.transacoes.values()].sort((a, b) => b.seqOrigem - a.seqOrigem);
  }

  possuiEvento(idEvento: string): boolean {
    return this.transacoes.has(idEvento);
  }

  contar(): number {
    return this.transacoes.size;
  }

  estatisticas(): {
    totalTransacoes: number;
    lotesProcessados: number;
    rollbacksRealizados: number;
    duplicatasDescartadasTotal: number;
    cortarNoMeioDoLote: boolean;
    forcarHttp503: boolean;
  } {
    return {
      totalTransacoes: this.transacoes.size,
      lotesProcessados: this.lotesProcessados,
      rollbacksRealizados: this.rollbacksRealizados,
      duplicatasDescartadasTotal: this.duplicatasDescartadasTotal,
      cortarNoMeioDoLote: this.cortarNoMeioDoLote,
      forcarHttp503: this.forcarHttp503,
    };
  }

  limpar(): void {
    this.transacoes.clear();
    this.rollbacksRealizados = 0;
    this.lotesProcessados = 0;
    this.duplicatasDescartadasTotal = 0;
    if (this.storage) this.storage.removeItem(this.chaveStorage);
  }
}
