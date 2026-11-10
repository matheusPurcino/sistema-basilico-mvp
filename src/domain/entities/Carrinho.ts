import { DomainError } from '../shared/errors';
import { assertCentavosNaoNegativos, percentualDeCentavos, somarCentavos, type Centavos } from '../shared/Money';
import { ItemVenda, type ItemVendaSnapshot } from './ItemVenda';
import type { Produto } from './Produto';

export interface CarrinhoSnapshot {
  itens: ItemVendaSnapshot[];
  descontoCentavos: number;
}

/**
 * Carrinho aberto do PDV (RF01). É persistido continuamente no SQLite
 * (journal WAL) a cada alteração, garantindo RPO = 0 (RNF01.3 / CT12).
 */
export class Carrinho {
  private itens: ItemVenda[] = [];
  private descontoCentavos: Centavos = 0;

  adicionar(produto: Pick<Produto, 'id' | 'nome' | 'precoCentavos'>, quantidade = 1): void {
    const existente = this.itens.find((i) => i.getIdProduto() === produto.id);
    if (existente) {
      existente.incrementar(quantidade);
    } else {
      this.itens.push(new ItemVenda(produto.id, produto.nome, quantidade, produto.precoCentavos));
    }
    this.ajustarDesconto();
  }

  alterarQuantidade(idProduto: number, quantidade: number): void {
    const idx = this.itens.findIndex((i) => i.getIdProduto() === idProduto);
    if (idx < 0) throw new DomainError('Item não está no carrinho.');
    if (quantidade <= 0) {
      this.itens.splice(idx, 1);
    } else {
      const atual = this.itens[idx];
      atual.incrementar(quantidade - atual.getQuantidade());
    }
    this.ajustarDesconto();
  }

  remover(idProduto: number): void {
    this.itens = this.itens.filter((i) => i.getIdProduto() !== idProduto);
    this.ajustarDesconto();
  }

  aplicarDesconto(descontoCentavos: number): void {
    assertCentavosNaoNegativos(descontoCentavos, 'desconto');
    if (descontoCentavos > this.getSubtotalCentavos()) {
      throw new DomainError('Desconto não pode exceder o subtotal.');
    }
    this.descontoCentavos = descontoCentavos;
  }

  aplicarDescontoPercentual(percentual: number): void {
    this.aplicarDesconto(percentualDeCentavos(this.getSubtotalCentavos(), percentual));
  }

  limpar(): void {
    this.itens = [];
    this.descontoCentavos = 0;
  }

  private ajustarDesconto(): void {
    if (this.descontoCentavos > this.getSubtotalCentavos()) this.descontoCentavos = this.getSubtotalCentavos();
  }

  getItens(): readonly ItemVenda[] {
    return [...this.itens];
  }
  getSubtotalCentavos(): Centavos {
    return somarCentavos(this.itens.map((i) => i.getSubtotalCentavos()));
  }
  getDescontoCentavos(): Centavos {
    return this.descontoCentavos;
  }
  getTotalCentavos(): Centavos {
    return this.getSubtotalCentavos() - this.descontoCentavos;
  }
  getQuantidadeItens(): number {
    return this.itens.reduce((acc, i) => acc + i.getQuantidade(), 0);
  }
  estaVazio(): boolean {
    return this.itens.length === 0;
  }

  toSnapshot(): CarrinhoSnapshot {
    return { itens: this.itens.map((i) => i.toSnapshot()), descontoCentavos: this.descontoCentavos };
  }

  static fromSnapshot(s: CarrinhoSnapshot): Carrinho {
    const c = new Carrinho();
    c.itens = s.itens.map((i) => ItemVenda.fromSnapshot(i));
    c.aplicarDesconto(s.descontoCentavos);
    return c;
  }
}
