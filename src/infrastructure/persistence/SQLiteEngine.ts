import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import { AcessoNegadoError, AesGcmCipher, base64ParaBytes, bytesParaBase64 } from './AesGcmCipher';
import type { KeyValueStorage } from './KeyValueStorage';
import { carregarSqlJs } from './sqljsLoader';

export type ParametroSql = string | number | null;
type Instrucao = [sql: string, params: ParametroSql[]];
interface FrameWal {
  seq: number;
  instrucoes: Instrucao[];
}

export interface OpcoesSQLiteEngine {
  /** Prefixo das chaves no armazenamento (ex.: "basilico.pdv"). */
  nome: string;
  storage: KeyValueStorage;
  /** Chave de cifragem AES-256 (passphrase). Ausente/incorreta ⇒ AcessoNegadoError. */
  chave?: string | null;
  /** DDL idempotente (CREATE ... IF NOT EXISTS) aplicado a cada abertura. */
  esquema?: readonly string[];
  /** Quantidade de frames WAL antes de um checkpoint (snapshot completo). */
  checkpointACada?: number;
  sqlJs?: SqlJsStatic;
}

const KEYCHECK = 'BASILICO::SQLCIPHER::AES-256-GCM::OK';
const enc = new TextEncoder();
const dec = new TextDecoder();

/**
 * SQLiteEngine — persistência local Offline-First (RF01, RNF01.2, RNF01.3).
 *
 * - Motor SQL: SQLite real compilado para WebAssembly (sql.js), com
 *   transações ACID (`BEGIN IMMEDIATE / COMMIT / ROLLBACK`).
 * - Modo WAL (Write-Ahead Log): cada transação confirmada gera um *frame*
 *   com as instruções executadas, cifrado com AES-256-GCM e anexado ao log
 *   durável ANTES do `persistir()` resolver (RPO = 0 para operações
 *   confirmadas). A cada N frames ocorre um *checkpoint* (snapshot completo
 *   cifrado) e os frames antigos são truncados — exatamente como o WAL do
 *   SQLite nativo.
 * - Reabertura (RTO): carrega o snapshot e reaplica os frames posteriores.
 * - Cifragem estilo SQLCipher: sem a chave correta o banco não abre e o
 *   conteúdo armazenado é ilegível.
 */
export class SQLiteEngine {
  private emTransacao = false;
  private bufferFrame: Instrucao[] = [];
  private pendentes: FrameWal[] = [];
  private filaPersistencia: Promise<void> = Promise.resolve();
  private framesNoWal: number;
  private checkpoints = 0;
  readonly pragmaJournalNativo: string;

  private constructor(
    private db: Database,
    private readonly cipher: AesGcmCipher,
    private readonly opts: Required<Pick<OpcoesSQLiteEngine, 'nome' | 'storage' | 'checkpointACada'>>,
    private ultimoSeq: number,
    framesNoWal: number,
    pragmaJournal: string,
  ) {
    this.framesNoWal = framesNoWal;
    this.pragmaJournalNativo = pragmaJournal;
  }

  static async abrir(opcoes: OpcoesSQLiteEngine): Promise<SQLiteEngine> {
    const { nome, storage } = opcoes;
    if (!opcoes.chave) {
      throw new AcessoNegadoError('Acesso negado: nenhuma chave de cifragem foi fornecida para abrir o banco local.');
    }
    const SQL = opcoes.sqlJs ?? (await carregarSqlJs());

    // 1) Verificação da chave (keycheck cifrado)
    let cipher: AesGcmCipher;
    const saltB64 = storage.getItem(`${nome}.salt`);
    if (saltB64) {
      cipher = await AesGcmCipher.derivar(opcoes.chave, base64ParaBytes(saltB64));
      const check = storage.getItem(`${nome}.keycheck`);
      if (!check) throw new AcessoNegadoError('Banco local corrompido: verificador de chave ausente.');
      const texto = dec.decode(await cipher.decifrar(base64ParaBytes(check)));
      if (texto !== KEYCHECK) throw new AcessoNegadoError();
    } else {
      const salt = AesGcmCipher.gerarSalt();
      cipher = await AesGcmCipher.derivar(opcoes.chave, salt);
      storage.setItem(`${nome}.salt`, bytesParaBase64(salt));
      storage.setItem(`${nome}.keycheck`, bytesParaBase64(await cipher.cifrar(enc.encode(KEYCHECK))));
    }

    // 2) Snapshot (checkpoint) mais recente
    let snapshotSeq = 0;
    let db: Database;
    const snap = storage.getItem(`${nome}.db`);
    if (snap) {
      const plano = await cipher.decifrar(base64ParaBytes(snap));
      snapshotSeq = new DataView(plano.buffer, plano.byteOffset, plano.byteLength).getUint32(0);
      db = new SQL.Database(plano.subarray(4));
    } else {
      db = new SQL.Database();
    }
    const pragma = db.exec('PRAGMA journal_mode = WAL;');
    const pragmaJournal = String(pragma[0]?.values[0]?.[0] ?? 'desconhecido');
    for (const ddl of opcoes.esquema ?? []) db.exec(ddl);

    // 3) Replay dos frames WAL posteriores ao snapshot
    const prefixo = `${nome}.wal.`;
    const frames = storage
      .chaves(prefixo)
      .map((k) => ({ k, seq: Number.parseInt(k.slice(prefixo.length), 10) }))
      .filter((f) => Number.isFinite(f.seq) && f.seq > snapshotSeq)
      .sort((a, b) => a.seq - b.seq);
    let ultimoSeq = snapshotSeq;
    for (const f of frames) {
      const instrucoes = JSON.parse(dec.decode(await cipher.decifrar(base64ParaBytes(storage.getItem(f.k)!)))) as Instrucao[];
      db.exec('BEGIN');
      try {
        for (const [sql, params] of instrucoes) db.run(sql, params as SqlValue[]);
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      ultimoSeq = f.seq;
    }

    return new SQLiteEngine(
      db,
      cipher,
      { nome, storage, checkpointACada: opcoes.checkpointACada ?? 50 },
      ultimoSeq,
      frames.length,
      pragmaJournal,
    );
  }

  /** Remove todos os dados persistidos de um banco (botão "Resetar demo"). */
  static apagarArmazenamento(storage: KeyValueStorage, nome: string): void {
    storage.chaves(`${nome}.`).forEach((k) => storage.removeItem(k));
  }

  // ───────────────────────── Execução SQL ─────────────────────────

  /**
   * Executa uma transação ACID SÍNCRONA. Se `fn` lançar exceção, é feito
   * ROLLBACK integral e nenhum frame WAL é gerado (CT03).
   */
  transacao<T>(fn: () => T): T {
    if (this.emTransacao) return fn(); // transações aninhadas participam da externa
    this.db.exec('BEGIN IMMEDIATE');
    this.emTransacao = true;
    this.bufferFrame = [];
    try {
      const resultado = fn();
      if (resultado instanceof Promise) throw new Error('transacao() aceita apenas funções síncronas.');
      this.db.exec('COMMIT');
      if (this.bufferFrame.length > 0) {
        this.ultimoSeq += 1;
        this.pendentes.push({ seq: this.ultimoSeq, instrucoes: this.bufferFrame });
      }
      return resultado;
    } catch (erro) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        /* transação já encerrada pelo SQLite */
      }
      throw erro;
    } finally {
      this.emTransacao = false;
      this.bufferFrame = [];
    }
  }

  /** Instrução de escrita (registrada no frame WAL da transação corrente). */
  executar(sql: string, params: ParametroSql[] = []): void {
    if (!this.emTransacao) {
      this.transacao(() => this.executar(sql, params));
      return;
    }
    this.db.run(sql, params);
    this.bufferFrame.push([sql, params]);
  }

  consultar<T = Record<string, ParametroSql>>(sql: string, params: ParametroSql[] = []): T[] {
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      const linhas: T[] = [];
      while (stmt.step()) linhas.push(stmt.getAsObject() as T);
      return linhas;
    } finally {
      stmt.free();
    }
  }

  consultarUm<T = Record<string, ParametroSql>>(sql: string, params: ParametroSql[] = []): T | undefined {
    return this.consultar<T>(sql, params)[0];
  }

  ultimoIdInserido(): number {
    return Number(this.consultarUm<{ id: number }>('SELECT last_insert_rowid() AS id')?.id ?? 0);
  }

  // ───────────────────────── Durabilidade ─────────────────────────

  /**
   * Garante que todos os frames confirmados estejam cifrados e gravados no
   * armazenamento durável. Chamadas são serializadas.
   */
  persistir(): Promise<void> {
    const p = this.filaPersistencia.then(() => this.descarregar());
    this.filaPersistencia = p.catch(() => undefined);
    return p;
  }

  private async descarregar(): Promise<void> {
    while (this.pendentes.length > 0) {
      const frame = this.pendentes[0];
      const blob = await this.cipher.cifrar(enc.encode(JSON.stringify(frame.instrucoes)));
      // o frame pode ter sido absorvido por um checkpoint durante o await
      if (this.pendentes[0] !== frame) continue;
      this.opts.storage.setItem(`${this.opts.nome}.wal.${String(frame.seq).padStart(10, '0')}`, bytesParaBase64(blob));
      this.pendentes.shift();
      this.framesNoWal += 1;
    }
    if (this.framesNoWal >= this.opts.checkpointACada) await this.checkpoint();
  }

  /** Checkpoint: grava snapshot completo cifrado e trunca o WAL. */
  async checkpoint(): Promise<void> {
    if (this.emTransacao) return;
    const seq = this.ultimoSeq;
    const bytesDb = this.db.export();
    const plano = new Uint8Array(4 + bytesDb.length);
    new DataView(plano.buffer).setUint32(0, seq);
    plano.set(bytesDb, 4);
    const blob = await this.cipher.cifrar(plano);
    const { storage, nome } = this.opts;
    storage.setItem(`${nome}.db`, bytesParaBase64(blob));
    const prefixo = `${nome}.wal.`;
    for (const k of storage.chaves(prefixo)) {
      if (Number.parseInt(k.slice(prefixo.length), 10) <= seq) storage.removeItem(k);
    }
    this.pendentes = this.pendentes.filter((f) => f.seq > seq);
    this.framesNoWal = storage.chaves(prefixo).length;
    this.checkpoints += 1;
  }

  // ───────────────────────── Introspecção (Inspetor Arquitetural) ─────────────────────────

  estatisticas(): {
    modoJournal: string;
    pragmaNativo: string;
    framesNoWal: number;
    framesPendentes: number;
    ultimoSeq: number;
    checkpoints: number;
    bytesArmazenados: number;
    amostraCifradaHex: string;
  } {
    const { storage, nome } = this.opts;
    let bytes = 0;
    for (const k of storage.chaves(`${nome}.`)) bytes += (storage.getItem(k) ?? '').length;
    const amostraB64 = storage.getItem(`${nome}.db`) ?? storage.getItem(`${nome}.keycheck`) ?? '';
    const amostra = amostraB64 ? base64ParaBytes(amostraB64).subarray(0, 32) : new Uint8Array();
    return {
      modoJournal: 'WAL (write-ahead log cifrado AES-256-GCM)',
      pragmaNativo: this.pragmaJournalNativo,
      framesNoWal: this.framesNoWal,
      framesPendentes: this.pendentes.length,
      ultimoSeq: this.ultimoSeq,
      checkpoints: this.checkpoints,
      bytesArmazenados: Math.floor((bytes * 3) / 4),
      amostraCifradaHex: Array.from(amostra, (b) => b.toString(16).padStart(2, '0')).join(' '),
    };
  }

  fechar(): void {
    this.db.close();
  }
}
