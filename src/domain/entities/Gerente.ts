import { DomainError, PermissaoNegadaError } from '../shared/errors';
import { gerarUuidV4 } from '../shared/uuid';
import type { Caixa } from './Caixa';
import { OperadorCaixa } from './OperadorCaixa';
import type { DadosUsuario, VerificadorSenha } from './Usuario';
import type { EventoCompensatorio } from './ValueObjects';

/**
 * Gerente extends OperadorCaixa — herda as capacidades do operador e detém
 * a exclusividade de estorno (RN02).
 */
export class Gerente extends OperadorCaixa {
  constructor(dados: DadosUsuario, verificador: VerificadorSenha) {
    super(dados, verificador, 'GERENTE');
  }

  /**
   * RN02 — não apaga a venda original; marca-a como estornada e gera um
   * EventoCompensatorio imutável vinculado ao UUID original.
   */
  autorizarEstorno(idVenda: string, motivo: string, caixa: Caixa, agora: Date = new Date()): EventoCompensatorio {
    if (!this.estaAutenticado()) {
      throw new PermissaoNegadaError('A credencial do Gerente precisa ser validada para autorizar o estorno.');
    }
    const motivoLimpo = motivo.trim();
    if (motivoLimpo.length < 5) throw new DomainError('Informe o motivo do estorno (mínimo 5 caracteres).');
    const venda = caixa.buscarVenda(idVenda);
    if (!venda) throw new DomainError(`Venda ${idVenda} não encontrada.`);
    venda.marcarEstornada();
    const evento: EventoCompensatorio = Object.freeze({
      idEvento: gerarUuidV4(),
      idVendaOriginal: venda.getIdVenda(),
      numeroVendaOriginal: venda.getNumeroSequencial(),
      motivo: motivoLimpo,
      valorEstornadoCentavos: venda.getValorTotalCentavos(),
      autorizadoPor: this.nome,
      dataHora: agora.toISOString(),
    });
    caixa.registrarEstorno(evento);
    return evento;
  }
}
