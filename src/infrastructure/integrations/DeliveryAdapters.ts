import {
  DomainError,
  ItemVenda,
  PedidoDelivery,
  RelogioSistema,
  reaisParaCentavos,
  type Clock,
  type IAuditLogRepository,
  type IPedidoRepository,
  type Plataforma,
} from '../../domain';

export type VersaoTls = 'TLSv1.3' | 'TLSv1.2' | 'TLSv1.1' | 'TLSv1.0';

export interface TokenOAuth2 {
  accessToken: string;
  expiraEmMs: number;
  renovacoes: number;
}

export interface PayloadParceiroItem {
  idProduto?: number;
  nome: string;
  quantidade: number;
  /** Parceiros podem enviar em centavos inteiros ou em reais decimais (normalizado na borda). */
  precoUnitarioCentavos?: number;
  precoUnitarioReais?: number;
}

export interface PayloadPedidoParceiro {
  codigoExterno: string;
  cliente: {
    nome: string;
    telefone: string;
    endereco: string;
  };
  itens: PayloadParceiroItem[];
  criadoEm?: string;
}

export interface RetentativaPollingAgendada {
  plataforma: Plataforma;
  intervaloSegundos: number;
  proximaExecucaoEm: string;
  motivo: string;
}

export interface ResultadoRecepcaoDelivery {
  status: 'ACEITO_FILA' | 'DUPLICATA_DESCARTADA' | 'RETENTATIVA_AGENDADA_503';
  pedido?: PedidoDelivery;
  retentativa?: RetentativaPollingAgendada;
  tokenRenovado: boolean;
}

export class ErroSegurancaTls extends DomainError {
  constructor(plataforma: Plataforma, versao: string) {
    super(
      `RNF03.2 [${plataforma}]: Conexão recusada. Exigido TLS 1.3, mas o endpoint negociou ${versao}.`,
      'TLS_INSEGURO',
    );
  }
}

/**
 * Classe base para os adaptadores das plataformas de delivery (RF03 / RNF03.2 / CT06 / CT07 / CT09).
 */
export abstract class BaseDeliveryAdapter {
  abstract readonly plataforma: Plataforma;
  private versaoTls: VersaoTls = 'TLSv1.3';
  private token: TokenOAuth2;
  private forcarHttp503 = false;
  private readonly filaPollingRemota: PayloadPedidoParceiro[] = [];
  private readonly retentativasAgendadas: RetentativaPollingAgendada[] = [];
  private readonly confirmacoesParceiro: { codigoExterno: string; status: 'CONFIRMADO' | 'RECUSADO'; em: string }[] = [];
  private readonly relogio: Clock;

  constructor(
    protected readonly pedidosRepo: IPedidoRepository,
    protected readonly auditRepo: IAuditLogRepository,
    relogio?: Clock,
  ) {
    this.relogio = relogio ?? new RelogioSistema();
    this.token = {
      accessToken: this.gerarNovoTokenString(0),
      expiraEmMs: this.relogio.agora().getTime() + 3600_000,
      renovacoes: 0,
    };
  }

  private gerarNovoTokenString(renovacoes: number): string {
    return `oauth2_${this.LuzPlataforma()}_v${renovacoes + 1}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private LuzPlataforma(): string {
    return (this.plataforma ?? 'partner').toLowerCase();
  }

  // ───────────────────────── Segurança TLS 1.3 & OAuth 2.0 (CT07) ─────────────────────────

  configurarVersaoTls(versao: VersaoTls): void {
    this.versaoTls = versao;
  }

  getVersaoTls(): VersaoTls {
    return this.versaoTls;
  }

  protected validarTls13(): void {
    if (this.versaoTls !== 'TLSv1.3') {
      this.auditRepo.registrar({
        dataHora: this.relogio.agora().toISOString(),
        usuario: `ADAPTER_${this.plataforma}`,
        acao: 'TLS_RECUSADO',
        categoria: 'SEGURANCA',
        entidadeId: this.plataforma,
        detalhes: `Handshake recusado por versão TLS insegura (${this.versaoTls} < TLSv1.3).`,
      });
      throw new ErroSegurancaTls(this.plataforma, this.versaoTls);
    }
  }

  expirarTokenOAuth(): void {
    this.token = {
      ...this.token,
      expiraEmMs: this.relogio.agora().getTime() - 1_000,
    };
  }

  getTokenOAuth(): Readonly<TokenOAuth2> {
    return { ...this.token };
  }

  protected garantirTokenValido(): boolean {
    const agoraMs = this.relogio.agora().getTime();
    if (agoraMs < this.token.expiraEmMs) return false;
    const novasRenovacoes = this.token.renovacoes + 1;
    this.token = {
      accessToken: this.gerarNovoTokenString(novasRenovacoes),
      expiraEmMs: agoraMs + 3600_000,
      renovacoes: novasRenovacoes,
    };
    this.auditRepo.registrar({
      dataHora: this.relogio.agora().toISOString(),
      usuario: `ADAPTER_${this.plataforma}`,
      acao: 'OAUTH2_TOKEN_RENOVADO',
      categoria: 'INTEGRACAO',
      entidadeId: this.plataforma,
      detalhes: `Token OAuth 2.0 expirado foi renovado automaticamente (renovação #${novasRenovacoes}).`,
    });
    return true;
  }

  // ───────────────────────── Simulação de Falha HTTP 503 (CT06) ─────────────────────────

  definirHttp503(ativo: boolean): void {
    this.forcarHttp503 = ativo;
  }

  isHttp503Ativo(): boolean {
    return this.forcarHttp503;
  }

  getRetentativasAgendadas(): readonly RetentativaPollingAgendada[] {
    return [...this.retentativasAgendadas];
  }

  // ───────────────────────── Recepção Webhook / Polling (RF03 / CT06 / CT07) ─────────────────────────

  enfileirarNoServidorParceiro(payload: PayloadPedidoParceiro): void {
    this.filaPollingRemota.push(payload);
  }

  executarCicloPolling(): ResultadoRecepcaoDelivery[] {
    this.validarTls13();
    const tokenRenovado = this.garantirTokenValido();

    if (this.forcarHttp503) {
      const retentativa = this.agendarRetentativa60s('HTTP 503 Service Unavailable no endpoint de polling');
      return [{ status: 'RETENTATIVA_AGENDADA_503', retentativa, tokenRenovado }];
    }

    const resultados: ResultadoRecepcaoDelivery[] = [];
    while (this.filaPollingRemota.length > 0) {
      const payload = this.filaPollingRemota.shift()!;
      const res = this.processarPayloadInterno(payload, tokenRenovado);
      resultados.push(res);
    }
    return resultados;
  }

  receberWebhook(payload: PayloadPedidoParceiro): ResultadoRecepcaoDelivery {
    this.validarTls13();
    const tokenRenovado = this.garantirTokenValido();

    if (this.forcarHttp503) {
      const retentativa = this.agendarRetentativa60s(
        `HTTP 503 ao confirmar recebimento do pedido ${payload.codigoExterno}`,
      );
      return { status: 'RETENTATIVA_AGENDADA_503', retentativa, tokenRenovado };
    }

    return this.processarPayloadInterno(payload, tokenRenovado);
  }

  private agendarRetentativa60s(motivo: string): RetentativaPollingAgendada {
    const agora = this.relogio.agora();
    const proxima = new Date(agora.getTime() + 60_000);
    const agendamento: RetentativaPollingAgendada = {
      plataforma: this.plataforma,
      intervaloSegundos: 60,
      proximaExecucaoEm: proxima.toISOString(),
      motivo,
    };
    this.retentativasAgendadas.push(agendamento);
    this.auditRepo.registrar({
      dataHora: agora.toISOString(),
      usuario: `ADAPTER_${this.plataforma}`,
      acao: 'DELIVERY_HTTP_503_RETRY_60S',
      categoria: 'INTEGRACAO',
      entidadeId: this.plataforma,
      detalhes: `${motivo}. Retentativa agendada em 60s (${proxima.toISOString()}).`,
    });
    return agendamento;
  }

  private processarPayloadInterno(
    payload: PayloadPedidoParceiro,
    tokenRenovado: boolean,
  ): ResultadoRecepcaoDelivery {
    const codigo = payload.codigoExterno.trim();
    if (this.pedidosRepo.existeCodigoExterno(this.plataforma, codigo)) {
      this.auditRepo.registrar({
        dataHora: this.relogio.agora().toISOString(),
        usuario: `ADAPTER_${this.plataforma}`,
        acao: 'DELIVERY_DUPLICATA_DESCARTADA',
        categoria: 'INTEGRACAO',
        entidadeId: codigo,
        detalhes: `Pedido duplicado (${this.plataforma} #${codigo}) descartado por idempotência de codigoExterno.`,
      });
      return { status: 'DUPLICATA_DESCARTADA', tokenRenovado };
    }

    const itens = payload.itens.map((item, idx) => {
      const centavos =
        item.precoUnitarioCentavos !== undefined
          ? item.precoUnitarioCentavos
          : reaisParaCentavos(item.precoUnitarioReais ?? 0);
      return new ItemVenda(item.idProduto ?? idx + 1, item.nome, item.quantidade, centavos);
    });

    const pedido = new PedidoDelivery({
      codigoExterno: codigo,
      plataforma: this.plataforma,
      clienteNome: payload.cliente.nome,
      clienteTelefone: payload.cliente.telefone,
      clienteEndereco: payload.cliente.endereco,
      itens,
      dataCriacao: payload.criadoEm ? new Date(payload.criadoEm) : this.relogio.agora(),
    });

    this.pedidosRepo.inserir(pedido);
    this.auditRepo.registrar({
      dataHora: this.relogio.agora().toISOString(),
      usuario: `ADAPTER_${this.plataforma}`,
      acao: 'DELIVERY_PEDIDO_RECEBIDO',
      categoria: 'DELIVERY',
      entidadeId: pedido.getIdInterno(),
      detalhes: `Pedido ${this.plataforma} #${codigo} recebido e normalizado (${itens.length} item(ns)).`,
    });

    return { status: 'ACEITO_FILA', pedido, tokenRenovado };
  }

  // ───────────────────────── Notificação à API Parceira (RF04 / CT09) ─────────────────────────

  confirmarAceiteParceiro(codigoExterno: string): void {
    this.validarTls13();
    this.garantirTokenValido();
    this.confirmacoesParceiro.push({
      codigoExterno,
      status: 'CONFIRMADO',
      em: this.relogio.agora().toISOString(),
    });
  }

  notificarRecusaParceiro(codigoExterno: string, _motivo: string): void {
    this.validarTls13();
    this.garantirTokenValido();
    this.confirmacoesParceiro.push({
      codigoExterno,
      status: 'RECUSADO',
      em: this.relogio.agora().toISOString(),
    });
  }

  getConfirmacoesParceiro(): readonly { codigoExterno: string; status: 'CONFIRMADO' | 'RECUSADO'; em: string }[] {
    return [...this.confirmacoesParceiro];
  }
}

export class IFoodAdapter extends BaseDeliveryAdapter {
  readonly plataforma: Plataforma = 'IFOOD';
}

export class AiqfomeAdapter extends BaseDeliveryAdapter {
  readonly plataforma: Plataforma = 'AIQFOME';
}
