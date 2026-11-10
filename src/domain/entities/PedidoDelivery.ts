import { DomainError, TransicaoInvalidaError } from '../shared/errors';
import { formatarBRL, somarCentavos, type Centavos } from '../shared/Money';
import { gerarUuidV4 } from '../shared/uuid';
import { DocumentoImpressao, type ImpressoraTermica, type LinhaDocumento, type ResultadoImpressao } from './DocumentoImpressao';
import { ItemVenda, type ItemVendaSnapshot } from './ItemVenda';

export type Plataforma = 'IFOOD' | 'AIQFOME';
export type StatusPedido = 'RECEBIDO' | 'PENDENTE_IMPRESSAO' | 'EM_PREPARO' | 'RECUSADO' | 'CONCLUIDO';

export interface PedidoDeliverySnapshot {
  idInterno: string;
  codigoExterno: string;
  plataforma: Plataforma;
  clienteNome: string;
  clienteTelefone: string;
  clienteEndereco: string;
  itens: ItemVendaSnapshot[];
  valorTotalCentavos: number;
  status: StatusPedido;
  dataCriacao: string;
  anonimizadoLgpd: boolean;
  motivoRecusa?: string | null;
  tentativasImpressao?: number;
}

export const MASCARAS_LGPD = {
  nome: 'Cliente Anonimizado (LGPD)',
  telefone: '(**) *****-****',
  endereco: '*** Endereço removido conforme LGPD ***',
} as const;

/** Transições válidas da máquina de estados do pedido de delivery. */
const TRANSICOES: Record<StatusPedido, StatusPedido[]> = {
  RECEBIDO: ['PENDENTE_IMPRESSAO', 'RECUSADO'],
  PENDENTE_IMPRESSAO: ['EM_PREPARO'],
  EM_PREPARO: ['CONCLUIDO'],
  RECUSADO: [],
  CONCLUIDO: [],
};

/**
 * PedidoDelivery (Figura 2) — normalização única de pedidos iFood e Aiqfome.
 *
 * RN03: o pedido SÓ assume `EM_PREPARO` após a confirmação FÍSICA da
 * impressora térmica. Sem papel → permanece `PENDENTE_IMPRESSAO`.
 */
export class PedidoDelivery {
  private readonly idInterno: string;
  private readonly codigoExterno: string;
  private readonly plataforma: Plataforma;
  private clienteNome: string;
  private clienteTelefone: string;
  private clienteEndereco: string;
  private readonly itens: ItemVenda[];
  private readonly valorTotalCentavos: Centavos;
  private status: StatusPedido = 'RECEBIDO';
  private readonly dataCriacao: Date;
  private anonimizadoLgpd = false;
  private motivoRecusa: string | null = null;
  private tentativasImpressao = 0;
  private ultimoResultadoImpressao: ResultadoImpressao | null = null;

  constructor(dados: {
    codigoExterno: string;
    plataforma: Plataforma;
    clienteNome: string;
    clienteTelefone: string;
    clienteEndereco: string;
    itens: ItemVenda[];
    valorTotalCentavos?: number;
    dataCriacao?: Date;
    idInterno?: string;
  }) {
    if (!dados.codigoExterno.trim()) throw new DomainError('codigoExterno é obrigatório.');
    if (dados.itens.length === 0) throw new DomainError('Pedido de delivery sem itens.');
    this.idInterno = dados.idInterno ?? gerarUuidV4();
    this.codigoExterno = dados.codigoExterno.trim();
    this.plataforma = dados.plataforma;
    this.clienteNome = dados.clienteNome;
    this.clienteTelefone = dados.clienteTelefone;
    this.clienteEndereco = dados.clienteEndereco;
    this.itens = [...dados.itens];
    this.valorTotalCentavos = dados.valorTotalCentavos ?? somarCentavos(this.itens.map((i) => i.getSubtotalCentavos()));
    this.dataCriacao = dados.dataCriacao ?? new Date();
  }

  private transicionar(para: StatusPedido): void {
    if (!TRANSICOES[this.status].includes(para)) {
      throw new TransicaoInvalidaError('PedidoDelivery', this.status, para);
    }
    this.status = para;
  }

  /**
   * Aceite (Figura 3): RECEBIDO → PENDENTE_IMPRESSAO → (impressão física) → EM_PREPARO.
   * A notificação à API parceira é feita pela camada de aplicação ANTES desta chamada.
   */
  aceitarPedido(impressora: ImpressoraTermica): boolean {
    this.transicionar('PENDENTE_IMPRESSAO');
    return this.imprimirViaCozinha(impressora);
  }

  recusarPedido(motivo: string): void {
    if (!motivo.trim()) throw new DomainError('Informe o motivo da recusa.');
    this.transicionar('RECUSADO');
    this.motivoRecusa = motivo.trim();
  }

  /**
   * Instancia o objeto transitório `via: DocumentoImpressao`, envia à
   * impressora, aguarda a confirmação física e destrói a via (finally).
   */
  imprimirViaCozinha(impressora: ImpressoraTermica): boolean {
    if (this.status !== 'PENDENTE_IMPRESSAO') {
      throw new DomainError(`Via de cozinha só pode ser impressa em PENDENTE_IMPRESSAO (atual: ${this.status}).`);
    }
    this.tentativasImpressao += 1;
    const via = new DocumentoImpressao('VIA_COZINHA', this.codigoExterno, this.montarViaCozinha());
    try {
      const resultado = impressora.imprimir(via);
      this.ultimoResultadoImpressao = resultado;
      if (resultado.sucesso) {
        this.transicionar('EM_PREPARO');
        return true;
      }
      return false;
    } finally {
      via.destruir(); // delete via
    }
  }

  concluir(): void {
    this.transicionar('CONCLUIDO');
  }

  /** RE01 — mascara dados pessoais preservando valores fiscais. */
  anonimizar(): void {
    this.clienteNome = MASCARAS_LGPD.nome;
    this.clienteTelefone = MASCARAS_LGPD.telefone;
    this.clienteEndereco = MASCARAS_LGPD.endereco;
    this.anonimizadoLgpd = true;
  }

  private montarViaCozinha(): LinhaDocumento[] {
    const hora = this.dataCriacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const linhas: LinhaDocumento[] = [
      { texto: 'BASILICO - VIA COZINHA', negrito: true, alinhamento: 'CENTRO', duplo: true },
      { texto: `${this.plataforma} #${this.codigoExterno}`, negrito: true, alinhamento: 'CENTRO' },
      { texto: `Recebido as ${hora}`, alinhamento: 'CENTRO' },
      { texto: '-'.repeat(42) },
    ];
    for (const item of this.itens) {
      linhas.push({ texto: `${String(item.getQuantidade()).padStart(2)}x ${item.getNomeProduto()}`, negrito: true });
    }
    linhas.push({ texto: '-'.repeat(42) });
    linhas.push({ texto: `Cliente: ${this.clienteNome}` });
    linhas.push({ texto: `Fone: ${this.clienteTelefone}` });
    linhas.push({ texto: `End.: ${this.clienteEndereco}` });
    linhas.push({ texto: `TOTAL: ${formatarBRL(this.valorTotalCentavos)}`, negrito: true, alinhamento: 'DIREITA' });
    return linhas;
  }

  getIdInterno(): string {
    return this.idInterno;
  }
  getCodigoExterno(): string {
    return this.codigoExterno;
  }
  getPlataforma(): Plataforma {
    return this.plataforma;
  }
  getClienteNome(): string {
    return this.clienteNome;
  }
  getClienteTelefone(): string {
    return this.clienteTelefone;
  }
  getClienteEndereco(): string {
    return this.clienteEndereco;
  }
  getItens(): readonly ItemVenda[] {
    return [...this.itens];
  }
  getValorTotalCentavos(): Centavos {
    return this.valorTotalCentavos;
  }
  getStatus(): StatusPedido {
    return this.status;
  }
  getDataCriacao(): Date {
    return new Date(this.dataCriacao.getTime());
  }
  isAnonimizadoLgpd(): boolean {
    return this.anonimizadoLgpd;
  }
  getMotivoRecusa(): string | null {
    return this.motivoRecusa;
  }
  getTentativasImpressao(): number {
    return this.tentativasImpressao;
  }
  getUltimoResultadoImpressao(): ResultadoImpressao | null {
    return this.ultimoResultadoImpressao;
  }

  toSnapshot(): PedidoDeliverySnapshot {
    return {
      idInterno: this.idInterno,
      codigoExterno: this.codigoExterno,
      plataforma: this.plataforma,
      clienteNome: this.clienteNome,
      clienteTelefone: this.clienteTelefone,
      clienteEndereco: this.clienteEndereco,
      itens: this.itens.map((i) => i.toSnapshot()),
      valorTotalCentavos: this.valorTotalCentavos,
      status: this.status,
      dataCriacao: this.dataCriacao.toISOString(),
      anonimizadoLgpd: this.anonimizadoLgpd,
      motivoRecusa: this.motivoRecusa,
      tentativasImpressao: this.tentativasImpressao,
    };
  }

  static fromSnapshot(s: PedidoDeliverySnapshot): PedidoDelivery {
    const p = new PedidoDelivery({
      idInterno: s.idInterno,
      codigoExterno: s.codigoExterno,
      plataforma: s.plataforma,
      clienteNome: s.clienteNome,
      clienteTelefone: s.clienteTelefone,
      clienteEndereco: s.clienteEndereco,
      itens: s.itens.map((i) => ItemVenda.fromSnapshot(i)),
      valorTotalCentavos: s.valorTotalCentavos,
      dataCriacao: new Date(s.dataCriacao),
    });
    p.status = s.status;
    p.anonimizadoLgpd = s.anonimizadoLgpd;
    p.motivoRecusa = s.motivoRecusa ?? null;
    p.tentativasImpressao = s.tentativasImpressao ?? 0;
    return p;
  }
}
