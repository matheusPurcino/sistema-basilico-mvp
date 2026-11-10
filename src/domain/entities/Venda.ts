import { DomainError } from '../shared/errors';
import { assertCentavosNaoNegativos, formatarBRL, somarCentavos, type Centavos } from '../shared/Money';
import { gerarUuidV4, isUuidV4 } from '../shared/uuid';
import { ItemVenda, type ItemVendaSnapshot } from './ItemVenda';

export const METODOS_PAGAMENTO = ['PIX', 'CREDITO', 'DEBITO', 'DINHEIRO'] as const;
export type MetodoPagamento = (typeof METODOS_PAGAMENTO)[number];

export function isMetodoPagamento(valor: string): valor is MetodoPagamento {
  return (METODOS_PAGAMENTO as readonly string[]).includes(valor);
}

export interface VendaSnapshot {
  idVenda: string;
  numeroSequencial: number;
  dataHora: string;
  valorTotalCentavos: number;
  descontoCentavos: number;
  metodoPagamento: MetodoPagamento | null;
  sincronizado: boolean;
  estornada: boolean;
  itens: ItemVendaSnapshot[];
  operador?: string;
}

/** Venda presencial do PDV (Figura 2). Todos os valores em centavos inteiros. */
export class Venda {
  private readonly idVenda: string;
  private readonly numeroSequencial: number;
  private readonly dataHora: Date;
  private valorTotalCentavos: Centavos = 0;
  private descontoCentavos: Centavos = 0;
  private metodoPagamento: MetodoPagamento | null = null;
  private sincronizado = false;
  private estornada = false;
  private readonly itens: ItemVenda[] = [];
  private operador: string | undefined;

  constructor(numeroSequencial: number, dataHora: Date = new Date(), idVenda: string = gerarUuidV4()) {
    if (!Number.isInteger(numeroSequencial) || numeroSequencial <= 0) {
      throw new DomainError('numeroSequencial deve ser inteiro positivo.');
    }
    if (!isUuidV4(idVenda)) throw new DomainError('idVenda deve ser um UUID v4.');
    this.idVenda = idVenda;
    this.numeroSequencial = numeroSequencial;
    this.dataHora = new Date(dataHora.getTime());
  }

  adicionarItem(item: ItemVenda): void {
    if (this.metodoPagamento) throw new DomainError('Venda já paga não aceita novos itens.');
    this.itens.push(item);
    this.recalcular();
  }

  aplicarDesconto(descontoCentavos: number): void {
    assertCentavosNaoNegativos(descontoCentavos, 'desconto');
    if (descontoCentavos > this.getSubtotalCentavos()) {
      throw new DomainError('Desconto não pode exceder o subtotal da venda.');
    }
    this.descontoCentavos = descontoCentavos;
    this.recalcular();
  }

  /** Retorna `false` para método inválido ou venda vazia (sem lançar exceção). */
  registrarPagamento(metodo: string): boolean {
    if (!isMetodoPagamento(metodo)) return false;
    if (this.itens.length === 0) return false;
    if (this.metodoPagamento) return false;
    this.metodoPagamento = metodo;
    return true;
  }

  gerarCupom(nomeEstabelecimento = 'RESTAURANTE BASÍLICO'): string {
    const largura = 42;
    const linha = '-'.repeat(largura);
    const centro = (t: string) => t.padStart(Math.floor((largura + t.length) / 2)).padEnd(largura);
    const dir = (esq: string, d: string) => esq.slice(0, largura - d.length - 1).padEnd(largura - d.length) + d;
    const out: string[] = [
      centro(nomeEstabelecimento),
      centro('Pouso Alegre/MG'),
      centro('CUPOM NÃO FISCAL - MVP'),
      linha,
      `Venda Nº ${String(this.numeroSequencial).padStart(6, '0')}`,
      `Data: ${this.dataHora.toLocaleString('pt-BR')}`,
      `ID: ${this.idVenda}`,
      linha,
    ];
    for (const item of this.itens) {
      out.push(item.getNomeProduto().slice(0, largura));
      out.push(
        dir(`  ${item.getQuantidade()} x ${formatarBRL(item.getPrecoUnitarioCentavos())}`, formatarBRL(item.getSubtotalCentavos())),
      );
    }
    out.push(linha);
    out.push(dir('Subtotal', formatarBRL(this.getSubtotalCentavos())));
    if (this.descontoCentavos > 0) out.push(dir('Desconto', `-${formatarBRL(this.descontoCentavos)}`));
    out.push(dir('TOTAL', formatarBRL(this.valorTotalCentavos)));
    out.push(dir('Pagamento', this.metodoPagamento ?? 'PENDENTE'));
    if (this.estornada) out.push(centro('*** VENDA ESTORNADA ***'));
    out.push(linha);
    out.push(centro('Obrigado e buon appetito!'));
    return out.join('\n');
  }

  marcarSincronizada(): void {
    this.sincronizado = true;
  }

  /** RN02 — a venda NUNCA é apagada; apenas sinalizada como estornada. */
  marcarEstornada(): void {
    if (this.estornada) throw new DomainError('Venda já foi estornada.');
    this.estornada = true;
  }

  definirOperador(nome: string): void {
    this.operador = nome;
  }

  private recalcular(): void {
    this.valorTotalCentavos = this.getSubtotalCentavos() - this.descontoCentavos;
  }

  getSubtotalCentavos(): Centavos {
    return somarCentavos(this.itens.map((i) => i.getSubtotalCentavos()));
  }
  getIdVenda(): string {
    return this.idVenda;
  }
  getNumeroSequencial(): number {
    return this.numeroSequencial;
  }
  getDataHora(): Date {
    return new Date(this.dataHora.getTime());
  }
  getValorTotalCentavos(): Centavos {
    return this.valorTotalCentavos;
  }
  getDescontoCentavos(): Centavos {
    return this.descontoCentavos;
  }
  getMetodoPagamento(): MetodoPagamento | null {
    return this.metodoPagamento;
  }
  isSincronizado(): boolean {
    return this.sincronizado;
  }
  isEstornada(): boolean {
    return this.estornada;
  }
  getItens(): readonly ItemVenda[] {
    return [...this.itens];
  }
  getOperador(): string | undefined {
    return this.operador;
  }

  toSnapshot(): VendaSnapshot {
    return {
      idVenda: this.idVenda,
      numeroSequencial: this.numeroSequencial,
      dataHora: this.dataHora.toISOString(),
      valorTotalCentavos: this.valorTotalCentavos,
      descontoCentavos: this.descontoCentavos,
      metodoPagamento: this.metodoPagamento,
      sincronizado: this.sincronizado,
      estornada: this.estornada,
      itens: this.itens.map((i) => i.toSnapshot()),
      operador: this.operador,
    };
  }

  static fromSnapshot(s: VendaSnapshot): Venda {
    const v = new Venda(s.numeroSequencial, new Date(s.dataHora), s.idVenda);
    s.itens.forEach((i) => v.adicionarItem(ItemVenda.fromSnapshot(i)));
    if (s.descontoCentavos) v.aplicarDesconto(s.descontoCentavos);
    if (s.metodoPagamento) v.registrarPagamento(s.metodoPagamento);
    v.sincronizado = s.sincronizado;
    v.estornada = s.estornada;
    v.operador = s.operador;
    return v;
  }
}
