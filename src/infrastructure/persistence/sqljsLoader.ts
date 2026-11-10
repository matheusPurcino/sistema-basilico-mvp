import initSqlJs, { type SqlJsStatic } from 'sql.js';

let instancia: Promise<SqlJsStatic> | null = null;
let localizador: ((arquivo: string) => string) | undefined;

/**
 * Define onde está o `sql-wasm.wasm` (necessário apenas no navegador/Electron).
 * Em Node/Vitest o sql.js encontra o WASM automaticamente em node_modules.
 */
export function configurarLocalizadorWasm(fn: (arquivo: string) => string): void {
  localizador = fn;
}

/** Carrega (uma única vez) o SQLite compilado para WebAssembly. */
export function carregarSqlJs(): Promise<SqlJsStatic> {
  if (!instancia) {
    instancia = initSqlJs(localizador ? { locateFile: localizador } : undefined);
  }
  return instancia;
}
