/**
 * Relógio injetável (RNF05.3 / CT04). Permite simular 30 minutos de
 * inatividade em testes e no botão do Header sem esperar tempo real.
 */
export interface Clock {
  agora(): Date;
}

export class RelogioSistema implements Clock {
  agora(): Date {
    return new Date();
  }
}

/** Relógio com deslocamento controlável (usado na UI e nos testes). */
export class RelogioAjustavel implements Clock {
  private deslocamentoMs = 0;
  constructor(private readonly base: () => number = () => Date.now()) {}

  agora(): Date {
    return new Date(this.base() + this.deslocamentoMs);
  }

  avancar(ms: number): void {
    this.deslocamentoMs += ms;
  }

  get deslocamento(): number {
    return this.deslocamentoMs;
  }
}

/** Relógio totalmente fixo e determinístico para testes unitários. */
export class RelogioFixo implements Clock {
  private atual: number;
  constructor(inicio: Date | string | number = '2026-01-15T12:00:00.000Z') {
    this.atual = new Date(inicio).getTime();
  }
  agora(): Date {
    return new Date(this.atual);
  }
  avancar(ms: number): void {
    this.atual += ms;
  }
  definir(data: Date | string | number): void {
    this.atual = new Date(data).getTime();
  }
}

export const MINUTO_MS = 60_000;
export const DIA_MS = 24 * 60 * MINUTO_MS;
