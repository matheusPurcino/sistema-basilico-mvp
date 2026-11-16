/**
 * Armazenamento chave-valor durável onde o SQLiteEngine grava snapshot e
 * frames WAL cifrados. No navegador/Electron usa `localStorage`; nos testes
 * usa memória (o mesmo objeto pode ser reaberto para simular reinício).
 */
export interface KeyValueStorage {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
  chaves(prefixo: string): string[];
  limparTudo?(): void;
}

export class MemoryStorage implements KeyValueStorage {
  private readonly dados = new Map<string, string>();
  getItem(chave: string): string | null {
    return this.dados.get(chave) ?? null;
  }
  setItem(chave: string, valor: string): void {
    this.dados.set(chave, valor);
  }
  removeItem(chave: string): void {
    this.dados.delete(chave);
  }
  chaves(prefixo: string): string[] {
    return [...this.dados.keys()].filter((k) => k.startsWith(prefixo));
  }
  limparTudo(): void {
    this.dados.clear();
  }
  get tamanho(): number {
    return this.dados.size;
  }
}

export class BrowserLocalStorage implements KeyValueStorage {
  constructor(private readonly ls: Storage = globalThis.localStorage) {}
  getItem(chave: string): string | null {
    return this.ls.getItem(chave);
  }
  setItem(chave: string, valor: string): void {
    this.ls.setItem(chave, valor);
  }
  removeItem(chave: string): void {
    this.ls.removeItem(chave);
  }
  chaves(prefixo: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < this.ls.length; i++) {
      const k = this.ls.key(i);
      if (k && k.startsWith(prefixo)) out.push(k);
    }
    return out;
  }
  limparTudo(): void {
    this.ls.clear();
  }
}
