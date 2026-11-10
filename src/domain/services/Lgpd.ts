import { DIA_MS } from '../shared/Clock';
import type { PedidoDelivery } from '../entities/PedidoDelivery';

/** Prazo de retenção de dados pessoais de clientes não fidelizados (RE01). */
export const PRAZO_RETENCAO_LGPD_DIAS = 180;

export interface PoliticaLgpd {
  prazoDias: number;
  /** Telefones de clientes fidelizados (consentimento ativo) — não anonimizar. */
  telefonesFidelizados: ReadonlySet<string>;
}

/**
 * Serviço de domínio puro da LGPD (RE01): decide se um pedido teve o prazo
 * legal de retenção vencido. Não altera valores fiscais.
 */
export function prazoLgpdVencido(pedido: PedidoDelivery, agora: Date, politica: PoliticaLgpd): boolean {
  if (pedido.isAnonimizadoLgpd()) return false;
  if (politica.telefonesFidelizados.has(pedido.getClienteTelefone())) return false;
  const idadeMs = agora.getTime() - pedido.getDataCriacao().getTime();
  return idadeMs > politica.prazoDias * DIA_MS;
}
