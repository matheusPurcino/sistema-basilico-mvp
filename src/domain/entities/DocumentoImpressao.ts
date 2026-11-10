import { DomainError } from '../shared/errors';

export type TipoDocumento = 'VIA_COZINHA' | 'CUPOM_VENDA';
export type AlinhamentoLinha = 'ESQUERDA' | 'CENTRO' | 'DIREITA';

export interface LinhaDocumento {
  texto: string;
  negrito?: boolean;
  alinhamento?: AlinhamentoLinha;
  duplo?: boolean;
}

/**
 * DocumentoImpressao — objeto TRANSITÓRIO do Diagrama de Sequência (Figura 3).
 *
 * É instanciado no momento do aceite, enviado como comandos ESC/POS à
 * impressora e explicitamente DESTRUÍDO (`destruir()` ≅ `delete via`) após a
 * confirmação física. O contador estático permite provar, no CT09, que não
 * há vazamento de instâncias.
 */
export class DocumentoImpressao {
  private static vivas = 0;
  private static criadasTotal = 0;

  private linhas: LinhaDocumento[];
  private destruido = false;
  readonly tipo: TipoDocumento;
  readonly referencia: string;
  readonly criadoEm: Date;

  constructor(tipo: TipoDocumento, referencia: string, linhas: LinhaDocumento[], criadoEm = new Date()) {
    if (linhas.length === 0) throw new DomainError('Documento de impressão vazio.');
    this.tipo = tipo;
    this.referencia = referencia;
    this.linhas = linhas.map((l) => ({ ...l }));
    this.criadoEm = criadoEm;
    DocumentoImpressao.vivas += 1;
    DocumentoImpressao.criadasTotal += 1;
  }

  getLinhas(): readonly LinhaDocumento[] {
    if (this.destruido) throw new DomainError('DocumentoImpressao já foi desalocado.');
    return this.linhas;
  }

  /** Equivalente ao `delete via` do diagrama de sequência. Idempotente. */
  destruir(): void {
    if (this.destruido) return;
    this.destruido = true;
    this.linhas = [];
    DocumentoImpressao.vivas -= 1;
  }

  isDestruido(): boolean {
    return this.destruido;
  }

  static instanciasVivas(): number {
    return DocumentoImpressao.vivas;
  }

  static instanciasCriadas(): number {
    return DocumentoImpressao.criadasTotal;
  }
}

/** Resultado da tentativa de impressão física. */
export interface ResultadoImpressao {
  sucesso: boolean;
  /** Tempo até a detecção do resultado (confirmação física ou falha). */
  tempoMs: number;
  erro?: 'SEM_PAPEL' | 'OFFLINE' | 'TAMPA_ABERTA';
  bytesEnviados: number;
}

/** Porta (contrato) da impressora térmica — implementada na infraestrutura. */
export interface ImpressoraTermica {
  readonly descricao: string;
  imprimir(doc: DocumentoImpressao): ResultadoImpressao;
  possuiPapel(): boolean;
}
