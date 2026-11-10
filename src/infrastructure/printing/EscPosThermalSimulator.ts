import type {
  DocumentoImpressao,
  ImpressoraTermica,
  LinhaDocumento,
  ResultadoImpressao,
  TipoDocumento,
} from '../../domain';

export interface TrabalhoImpresso {
  idJob: number;
  tipo: TipoDocumento;
  referencia: string;
  impressoEm: string;
  linhasRenderizadas: string[];
  bytesEscPos: Uint8Array;
  hexDump: string;
  tempoMs: number;
  porta: string;
}

/**
 * Comandos binários ESC/POS reais (Epson Standard Code for POS Printers).
 */
export const COMANDOS_ESCPOS = {
  ESC_INIT: [0x1b, 0x40] as const, // ESC @
  ESC_CODEPAGE_850: [0x1b, 0x74, 0x02] as const, // ESC t 2
  ESC_ALIGN_LEFT: [0x1b, 0x61, 0x00] as const, // ESC a 0
  ESC_ALIGN_CENTER: [0x1b, 0x61, 0x01] as const, // ESC a 1
  ESC_ALIGN_RIGHT: [0x1b, 0x61, 0x02] as const, // ESC a 2
  ESC_BOLD_ON: [0x1b, 0x45, 0x01] as const, // ESC E 1
  ESC_BOLD_OFF: [0x1b, 0x45, 0x00] as const, // ESC E 0
  GS_DOUBLE_ON: [0x1d, 0x21, 0x11] as const, // GS ! 0x11
  GS_DOUBLE_OFF: [0x1d, 0x21, 0x00] as const, // GS ! 0x00
  GS_PARTIAL_CUT: [0x1d, 0x56, 0x41, 0x03] as const, // GS V A 3
} as const;

const LARGURA_BOBINA_80MM = 42;

/**
 * EscPosThermalSimulator — Simulador da Impressora Térmica 80mm na porta 9100/USB
 * e fallback TypeScript determinístico do addon C++ (`addons/escpos_driver.cpp`).
 *
 * Atende a:
 * - RF04 / RN03 / CT09: Confirmação física em <= 5s, geração do stream binário ESC/POS
 *   e renderização da bobina térmica de 80mm em tempo real.
 * - RN03 / CT14: Quando configurada sem bobina de papel (`definirBobinaPresente(false)`),
 *   detecta a falha física (`DLE EOT 4` = 0x72) em <= 3s (180ms), retorna `erro: 'SEM_PAPEL'`
 *   e impede que o pedido mude para `EM_PREPARO`.
 */
export class EscPosThermalSimulator implements ImpressoraTermica {
  readonly descricao = 'Epson TM-T20X Virtual (ESC/POS · 80mm · TCP 9100 / N-API)';
  private bobinaPresente = true;
  private proximoJobId = 1;
  private readonly historicoBobina: TrabalhoImpresso[] = [];
  private falhasSemPapel = 0;

  possuiPapel(): boolean {
    return this.bobinaPresente;
  }

  definirBobinaPresente(presente: boolean): void {
    this.bobinaPresente = presente;
  }

  imprimir(doc: DocumentoImpressao): ResultadoImpressao {
    const linhas = doc.getLinhas();
    const buffer = this.compilarBytesEscPos(linhas);

    // Sensor físico DLE EOT 4: sem papel detectado em 180ms (<= 3000ms exigido pela RN03 / CT14)
    if (!this.bobinaPresente) {
      this.falhasSemPapel += 1;
      return {
        sucesso: false,
        tempoMs: 180,
        erro: 'SEM_PAPEL',
        bytesEnviados: 0,
      };
    }

    const linhasRenderizadas = linhas.map((l) => this.formatarLinha80mm(l));
    const tempoMs = 120; // <= 5000ms exigido pelo RNF04.1 / CT09
    const trabalho: TrabalhoImpresso = {
      idJob: this.proximoJobId++,
      tipo: doc.tipo,
      referencia: doc.referencia,
      impressoEm: doc.criadoEm.toISOString(),
      linhasRenderizadas,
      bytesEscPos: buffer,
      hexDump: this.gerarHexDump(buffer, 96),
      tempoMs,
      porta: 'tcp://127.0.0.1:9100',
    };
    this.historicoBobina.unshift(trabalho);
    if (this.historicoBobina.length > 50) this.historicoBobina.pop();

    return {
      sucesso: true,
      tempoMs,
      bytesEnviados: buffer.byteLength,
    };
  }

  /** Imprime texto bruto de cupom fiscal/não-fiscal na bobina de 80mm. */
  imprimirCupomTexto(referencia: string, cupomTexto: string, criadoEm = new Date()): ResultadoImpressao {
    const linhas: LinhaDocumento[] = cupomTexto.split('\n').map((texto, idx) => ({
      texto,
      negrito: idx < 3 || texto.startsWith('TOTAL'),
      alinhamento: idx < 3 ? 'CENTRO' : 'ESQUERDA',
    }));
    const bytes = this.compilarBytesEscPos(linhas);
    if (!this.bobinaPresente) {
      this.falhasSemPapel += 1;
      return { sucesso: false, tempoMs: 180, erro: 'SEM_PAPEL', bytesEnviados: 0 };
    }
    const trabalho: TrabalhoImpresso = {
      idJob: this.proximoJobId++,
      tipo: 'CUPOM_VENDA',
      referencia,
      impressoEm: criadoEm.toISOString(),
      linhasRenderizadas: linhas.map((l) => this.formatarLinha80mm(l)),
      bytesEscPos: bytes,
      hexDump: this.gerarHexDump(bytes, 96),
      tempoMs: 95,
      porta: 'tcp://127.0.0.1:9100',
    };
    this.historicoBobina.unshift(trabalho);
    return { sucesso: true, tempoMs: 95, bytesEnviados: bytes.byteLength };
  }

  compilarBytesEscPos(linhas: readonly LinhaDocumento[]): Uint8Array {
    const bytes: number[] = [...COMANDOS_ESCPOS.ESC_INIT, ...COMANDOS_ESCPOS.ESC_CODEPAGE_850];

    for (const l of linhas) {
      if (l.alinhamento === 'CENTRO') bytes.push(...COMANDOS_ESCPOS.ESC_ALIGN_CENTER);
      else if (l.alinhamento === 'DIREITA') bytes.push(...COMANDOS_ESCPOS.ESC_ALIGN_RIGHT);
      else bytes.push(...COMANDOS_ESCPOS.ESC_ALIGN_LEFT);

      bytes.push(...(l.negrito ? COMANDOS_ESCPOS.ESC_BOLD_ON : COMANDOS_ESCPOS.ESC_BOLD_OFF));
      bytes.push(...(l.duplo ? COMANDOS_ESCPOS.GS_DOUBLE_ON : COMANDOS_ESCPOS.GS_DOUBLE_OFF));

      for (let i = 0; i < l.texto.length; i++) {
        bytes.push(l.texto.charCodeAt(i) & 0xff);
      }
      bytes.push(0x0a); // LF
    }

    bytes.push(...COMANDOS_ESCPOS.ESC_BOLD_OFF, ...COMANDOS_ESCPOS.GS_DOUBLE_OFF, ...COMANDOS_ESCPOS.GS_PARTIAL_CUT);
    return new Uint8Array(bytes);
  }

  private formatarLinha80mm(l: LinhaDocumento): string {
    const t = l.texto.slice(0, LARGURA_BOBINA_80MM);
    if (l.alinhamento === 'CENTRO') {
      const esq = Math.floor((LARGURA_BOBINA_80MM - t.length) / 2);
      return t.padStart(esq + t.length).padEnd(LARGURA_BOBINA_80MM);
    }
    if (l.alinhamento === 'DIREITA') {
      return t.padStart(LARGURA_BOBINA_80MM);
    }
    return t;
  }

  private gerarHexDump(buf: Uint8Array, maxBytes: number): string {
    const slice = buf.subarray(0, maxBytes);
    const hex = Array.from(slice, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    return buf.length > maxBytes ? `${hex} … (+${buf.length - maxBytes} bytes)` : hex;
  }

  obterUltimaImpressao(): TrabalhoImpresso | null {
    return this.historicoBobina[0] ?? null;
  }

  listarHistorico(): readonly TrabalhoImpresso[] {
    return [...this.historicoBobina];
  }

  getFalhasSemPapel(): number {
    return this.falhasSemPapel;
  }

  limparHistorico(): void {
    this.historicoBobina.length = 0;
    this.falhasSemPapel = 0;
  }
}
