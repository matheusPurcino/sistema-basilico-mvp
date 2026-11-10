import type { Centavos } from '../shared/Money';
import type { MetodoPagamento } from './Venda';

/**
 * EventoCompensatorio (RN02) — o estorno NUNCA apaga a venda original:
 * gera um evento compensatório imutável vinculado ao UUID da venda.
 */
export interface EventoCompensatorio {
  readonly idEvento: string;
  readonly idVendaOriginal: string;
  readonly numeroVendaOriginal: number;
  readonly motivo: string;
  readonly valorEstornadoCentavos: Centavos;
  readonly autorizadoPor: string;
  readonly dataHora: string;
}

/** Relatório emitido em `OperadorCaixa.fecharCaixa()` (RN04 / CT11). */
export interface RelatorioFechamento {
  readonly idFechamento: string;
  readonly operador: string;
  readonly abertoEm: string;
  readonly fechadoEm: string;
  readonly modo: 'ONLINE' | 'OFFLINE';
  readonly saldoInicialCentavos: Centavos;
  readonly totalVendasBrutoCentavos: Centavos;
  readonly totalEstornosCentavos: Centavos;
  readonly saldoFinalCentavos: Centavos;
  readonly quantidadeVendas: number;
  readonly quantidadeEstornos: number;
  readonly totaisPorMetodo: Readonly<Record<MetodoPagamento, Centavos>>;
  /** Eventos ainda na Outbox local (não sincronizados). */
  readonly pendenciasOutbox: number;
  /** RN04 — alerta de pendência quando há eventos não sincronizados. */
  readonly alertaPendencia: boolean;
  readonly ressalvas: readonly string[];
}
