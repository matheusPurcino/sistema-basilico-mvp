import type { Caixa } from './Caixa';
import { Usuario, type DadosUsuario, type Papel, type VerificadorSenha } from './Usuario';
import type { RelatorioFechamento } from './ValueObjects';

/** OperadorCaixa extends Usuario — Figura 2. */
export class OperadorCaixa extends Usuario {
  constructor(dados: DadosUsuario, verificador: VerificadorSenha, papel: Papel = 'OPERADOR') {
    super(dados, papel, verificador);
  }

  abrirCaixa(caixa: Caixa, saldoInicialCentavos: number): void {
    this.exigirAutenticacao('abrir o caixa');
    caixa.abrir(saldoInicialCentavos, this.nome);
  }

  /** RN04: o relatório traz alerta/ressalva se houver pendências na Outbox. */
  fecharCaixa(caixa: Caixa): RelatorioFechamento {
    this.exigirAutenticacao('fechar o caixa');
    return caixa.fechar(this.nome);
  }
}
