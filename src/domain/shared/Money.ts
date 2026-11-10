/**
 * Objeto de Valor monetário — RF01 / CT01.
 *
 * Todo cálculo financeiro do Sistema Basílico é feito em CENTAVOS INTEIROS.
 * Nunca usamos `number` em reais com casas decimais para somar valores, pois
 * 0.1 + 0.2 !== 0.3 em ponto flutuante IEEE-754.
 */
import { DomainError } from './errors';

export type Centavos = number;

export function assertCentavos(valor: number, campo = 'valor'): Centavos {
  if (!Number.isSafeInteger(valor)) {
    throw new DomainError(`${campo} deve ser um inteiro em centavos (recebido: ${valor}).`);
  }
  return valor;
}

export function assertCentavosNaoNegativos(valor: number, campo = 'valor'): Centavos {
  assertCentavos(valor, campo);
  if (valor < 0) throw new DomainError(`${campo} não pode ser negativo.`);
  return valor;
}

/** Soma uma lista de centavos garantindo que todos são inteiros seguros. */
export function somarCentavos(valores: readonly number[]): Centavos {
  return valores.reduce<number>((acc, v) => acc + assertCentavos(v), 0);
}

/** Multiplica centavos por uma quantidade inteira. */
export function multiplicarCentavos(precoCentavos: number, quantidade: number): Centavos {
  assertCentavos(precoCentavos, 'preço');
  if (!Number.isSafeInteger(quantidade)) throw new DomainError('Quantidade deve ser inteira.');
  return precoCentavos * quantidade;
}

/** Percentual aplicado em centavos com arredondamento bancário-simples (half-up). */
export function percentualDeCentavos(baseCentavos: number, percentual: number): Centavos {
  assertCentavos(baseCentavos, 'base');
  if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
    throw new DomainError('Percentual deve estar entre 0 e 100.');
  }
  // Trabalha em "centésimos de ponto percentual" para evitar flutuação.
  const basisPoints = Math.round(percentual * 100);
  return Math.floor((baseCentavos * basisPoints + 5000) / 10000);
}

/**
 * Converte texto/valor em reais (ex.: "42,90", "42.9", 42.9) em centavos inteiros.
 * Usado SOMENTE na borda (entrada do usuário e payloads de parceiros como o iFood,
 * que enviam reais em ponto flutuante).
 */
export function reaisParaCentavos(entrada: string | number): Centavos {
  if (typeof entrada === 'number') {
    if (!Number.isFinite(entrada)) throw new DomainError('Valor monetário inválido.');
    return Math.round(entrada * 100);
  }
  const limpo = entrada.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  // Formato brasileiro ("1.234,56"): ponto = milhar, vírgula = decimal.
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalizado)) {
    throw new DomainError(`Valor monetário inválido: "${entrada}".`);
  }
  const [inteiro, frac = ''] = normalizado.split('.');
  const negativo = inteiro.startsWith('-');
  const centavos = Math.abs(parseInt(inteiro, 10)) * 100 + parseInt((frac + '00').slice(0, 2), 10);
  return negativo ? -centavos : centavos;
}

/** Formata centavos em BRL ("R$ 1.234,56") sem passar por float. */
export function formatarBRL(centavos: number): string {
  assertCentavos(centavos);
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = (abs % 100).toString().padStart(2, '0');
  return `${negativo ? '-' : ''}R$ ${reais},${cents}`;
}
