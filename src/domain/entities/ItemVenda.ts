import { DomainError } from '../shared/errors';
import { assertCentavosNaoNegativos, multiplicarCentavos, type Centavos } from '../shared/Money';

export interface ItemVendaSnapshot {
  idProduto: number;
  nomeProduto: string;
  quantidade: number;
  precoUnitarioCentavos: number;
}

/**
 * ItemVenda — composição forte (1..*) com Venda e PedidoDelivery (Figura 2).
 * Preserva o PREÇO HISTÓRICO do momento da venda: alterações posteriores
 * no catálogo não afetam vendas já registradas.
 */
export class ItemVenda {
  private readonly idProduto: number;
  private readonly nomeProduto: string;
  private quantidade: number;
  private readonly precoUnitarioCentavos: number;

  constructor(idProduto: number, nomeProduto: string, quantidade: number, precoUnitarioCentavos: number) {
    if (!Number.isInteger(idProduto)) throw new DomainError('idProduto deve ser inteiro.');
    if (!nomeProduto.trim()) throw new DomainError('nomeProduto é obrigatório.');
    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      throw new DomainError('Quantidade deve ser um inteiro positivo.');
    }
    assertCentavosNaoNegativos(precoUnitarioCentavos, 'precoUnitarioCentavos');
    this.idProduto = idProduto;
    this.nomeProduto = nomeProduto.trim();
    this.quantidade = quantidade;
    this.precoUnitarioCentavos = precoUnitarioCentavos;
  }

  getIdProduto(): number {
    return this.idProduto;
  }
  getNomeProduto(): string {
    return this.nomeProduto;
  }
  getQuantidade(): number {
    return this.quantidade;
  }
  getPrecoUnitarioCentavos(): Centavos {
    return this.precoUnitarioCentavos;
  }
  getSubtotalCentavos(): Centavos {
    return multiplicarCentavos(this.precoUnitarioCentavos, this.quantidade);
  }

  /** Usado pelo carrinho ao somar unidades do mesmo produto. */
  incrementar(qtd: number): void {
    if (!Number.isInteger(qtd) || this.quantidade + qtd <= 0) {
      throw new DomainError('Quantidade resultante deve ser um inteiro positivo.');
    }
    this.quantidade += qtd;
  }

  toSnapshot(): ItemVendaSnapshot {
    return {
      idProduto: this.idProduto,
      nomeProduto: this.nomeProduto,
      quantidade: this.quantidade,
      precoUnitarioCentavos: this.precoUnitarioCentavos,
    };
  }

  static fromSnapshot(s: ItemVendaSnapshot): ItemVenda {
    return new ItemVenda(s.idProduto, s.nomeProduto, s.quantidade, s.precoUnitarioCentavos);
  }
}
