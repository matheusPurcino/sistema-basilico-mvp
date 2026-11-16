/**
 * Camada de cifragem AES-256-GCM (wrapper estilo SQLCipher) — RNF01.2 / CT10.
 *
 * Usa a WebCrypto API (disponível no navegador, no Electron e no Node ≥ 19),
 * com derivação de chave PBKDF2-SHA256. O GCM é autenticado: qualquer chave
 * incorreta resulta em falha de decifragem (acesso negado), e o conteúdo
 * persistido é ilegível sem a chave.
 */
export class AcessoNegadoError extends Error {
  constructor(mensagem = 'Acesso negado: chave de cifragem do banco local ausente ou incorreta.') {
    super(mensagem);
    this.name = 'AcessoNegadoError';
  }
}

const MAGIC = new TextEncoder().encode('BSLC1'); // Basílico SQLCipher v1
const IV_BYTES = 12;
export const PBKDF2_ITERACOES = 120_000;
export const CHAVE_FALLBACK_WEB_DEMO = 'BASILICO_WEB_DEMO_KEY_MVP_2026_AES';

/**
 * Helper isomórfico para resolver a chave AES-256 em Browser (Vite) e Node/Electron.
 * Ordem de precedência:
 * 1. `import.meta.env.VITE_ENCRYPTION_KEY` (Vite / Vercel / Browser)
 * 2. `process.env.ENCRYPTION_KEY` ou `process.env.CHAVE_CIFRAGEM` (Node / Electron)
 * 3. Chave de fallback padrão de demonstração (`CHAVE_FALLBACK_WEB_DEMO`)
 */
export function obterChaveCifragemIsomorfica(): string {
  try {
    const metaEnv =
      typeof import.meta !== 'undefined'
        ? (import.meta as unknown as { env?: Record<string, unknown> }).env
        : undefined;
    if (metaEnv && typeof metaEnv.VITE_ENCRYPTION_KEY === 'string' && metaEnv.VITE_ENCRYPTION_KEY.trim()) {
      return metaEnv.VITE_ENCRYPTION_KEY.trim();
    }
  } catch {
    /* ambiente sem suporte a import.meta */
  }

  try {
    if (typeof process !== 'undefined' && process?.env) {
      const nodeKey = process.env.ENCRYPTION_KEY ?? process.env.CHAVE_CIFRAGEM;
      if (typeof nodeKey === 'string' && nodeKey.trim()) {
        return nodeKey.trim();
      }
    }
  } catch {
    /* navegador sem polyfill de process */
  }

  return CHAVE_FALLBACK_WEB_DEMO;
}

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('WebCrypto indisponível neste ambiente.');
  return s;
}

export class AesGcmCipher {
  private constructor(private readonly chave: CryptoKey) {}

  static gerarSalt(): Uint8Array {
    return globalThis.crypto.getRandomValues(new Uint8Array(16));
  }

  static async derivar(senha: string | undefined | null, salt: Uint8Array): Promise<AesGcmCipher> {
    if (!senha) throw new AcessoNegadoError('Acesso negado: nenhuma chave de cifragem foi fornecida.');
    const material = await subtle().importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
    const chave = await subtle().deriveKey(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERACOES, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    return new AesGcmCipher(chave);
  }

  async cifrar(dados: Uint8Array): Promise<Uint8Array> {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const cifrado = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, this.chave, dados as BufferSource));
    const saida = new Uint8Array(MAGIC.length + IV_BYTES + cifrado.length);
    saida.set(MAGIC, 0);
    saida.set(iv, MAGIC.length);
    saida.set(cifrado, MAGIC.length + IV_BYTES);
    return saida;
  }

  async decifrar(blob: Uint8Array): Promise<Uint8Array> {
    for (let i = 0; i < MAGIC.length; i++) {
      if (blob[i] !== MAGIC[i]) throw new AcessoNegadoError('Arquivo não reconhecido como banco Basílico cifrado.');
    }
    const iv = blob.slice(MAGIC.length, MAGIC.length + IV_BYTES);
    const corpo = blob.slice(MAGIC.length + IV_BYTES);
    try {
      return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, this.chave, corpo));
    } catch {
      throw new AcessoNegadoError();
    }
  }
}

// ───────────── utilitários Base64 compatíveis com browser e Node ─────────────
export function bytesParaBase64(bytes: Uint8Array): string {
  let bin = '';
  const passo = 0x8000;
  for (let i = 0; i < bytes.length; i += passo) {
    bin += String.fromCharCode(...bytes.subarray(i, i + passo));
  }
  return btoa(bin);
}

export function base64ParaBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
