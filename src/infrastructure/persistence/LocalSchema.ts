/**
 * Esquema do banco LOCAL (SQLite do PDV) — Seções 7.2/8 da Entrega 1.
 * Todas as instruções são idempotentes e aplicadas a cada abertura.
 */
export const ESQUEMA_LOCAL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS usuarios (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     nome TEXT NOT NULL UNIQUE,
     email TEXT NOT NULL UNIQUE,
     senha_hash TEXT NOT NULL,
     papel TEXT NOT NULL CHECK (papel IN ('OPERADOR','GERENTE'))
   );`,
  `CREATE TABLE IF NOT EXISTS produtos (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     nome TEXT NOT NULL,
     descricao TEXT NOT NULL DEFAULT '',
     categoria TEXT NOT NULL,
     preco_centavos INTEGER NOT NULL CHECK (preco_centavos > 0),
     ativo INTEGER NOT NULL DEFAULT 1
   );`,
  `CREATE TABLE IF NOT EXISTS vendas (
     id_venda TEXT PRIMARY KEY,
     numero_sequencial INTEGER NOT NULL UNIQUE,
     data_hora TEXT NOT NULL,
     valor_total_centavos INTEGER NOT NULL,
     desconto_centavos INTEGER NOT NULL DEFAULT 0,
     metodo_pagamento TEXT NOT NULL CHECK (metodo_pagamento IN ('PIX','CREDITO','DEBITO','DINHEIRO')),
     sincronizado INTEGER NOT NULL DEFAULT 0,
     estornada INTEGER NOT NULL DEFAULT 0,
     operador TEXT
   );`,
  `CREATE TABLE IF NOT EXISTS itens_venda (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     id_venda TEXT NOT NULL REFERENCES vendas(id_venda),
     id_produto INTEGER NOT NULL,
     nome_produto TEXT NOT NULL,
     quantidade INTEGER NOT NULL CHECK (quantidade > 0),
     preco_unitario_centavos INTEGER NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS eventos_compensatorios (
     id_evento TEXT PRIMARY KEY,
     id_venda_original TEXT NOT NULL REFERENCES vendas(id_venda),
     numero_venda_original INTEGER NOT NULL,
     motivo TEXT NOT NULL,
     valor_estornado_centavos INTEGER NOT NULL,
     autorizado_por TEXT NOT NULL,
     data_hora TEXT NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS outbox_events (
     seq INTEGER PRIMARY KEY AUTOINCREMENT,
     id_evento TEXT NOT NULL UNIQUE,
     tipo TEXT NOT NULL,
     agregado_id TEXT NOT NULL,
     payload TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE','SINCRONIZADO','DEAD_LETTER')),
     tentativas INTEGER NOT NULL DEFAULT 0,
     ultimo_erro TEXT,
     criado_em TEXT NOT NULL,
     sincronizado_em TEXT
   );`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_status_seq ON outbox_events(status, seq);`,
  `CREATE TABLE IF NOT EXISTS pedidos_delivery (
     id_interno TEXT PRIMARY KEY,
     codigo_externo TEXT NOT NULL,
     plataforma TEXT NOT NULL CHECK (plataforma IN ('IFOOD','AIQFOME')),
     cliente_nome TEXT NOT NULL,
     cliente_telefone TEXT NOT NULL,
     cliente_endereco TEXT NOT NULL,
     itens_json TEXT NOT NULL,
     valor_total_centavos INTEGER NOT NULL,
     status TEXT NOT NULL,
     data_criacao TEXT NOT NULL,
     anonimizado_lgpd INTEGER NOT NULL DEFAULT 0,
     motivo_recusa TEXT,
     tentativas_impressao INTEGER NOT NULL DEFAULT 0,
     UNIQUE (plataforma, codigo_externo)
   );`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     data_hora TEXT NOT NULL,
     usuario TEXT NOT NULL,
     acao TEXT NOT NULL,
     categoria TEXT NOT NULL,
     entidade_id TEXT,
     detalhes TEXT NOT NULL
   );`,
  // Log de auditoria IMUTÁVEL (RN02): o próprio SQLite rejeita UPDATE/DELETE.
  `CREATE TRIGGER IF NOT EXISTS audit_logs_sem_update BEFORE UPDATE ON audit_logs
   BEGIN SELECT RAISE(ABORT, 'audit_logs é imutável (RN02)'); END;`,
  `CREATE TRIGGER IF NOT EXISTS audit_logs_sem_delete BEFORE DELETE ON audit_logs
   BEGIN SELECT RAISE(ABORT, 'audit_logs é imutável (RN02)'); END;`,
  // Vendas nunca são apagadas (RN02).
  `CREATE TRIGGER IF NOT EXISTS vendas_sem_delete BEFORE DELETE ON vendas
   BEGIN SELECT RAISE(ABORT, 'vendas não podem ser apagadas; use estorno (RN02)'); END;`,
  `CREATE TABLE IF NOT EXISTS carrinho_aberto (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     itens_json TEXT NOT NULL,
     desconto_centavos INTEGER NOT NULL DEFAULT 0,
     atualizado_em TEXT NOT NULL
   );`,
  `CREATE TABLE IF NOT EXISTS caixa_estado (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     aberto INTEGER NOT NULL,
     saldo_inicial_centavos INTEGER NOT NULL,
     saldo_local_centavos INTEGER NOT NULL,
     aberto_em TEXT,
     operador_abertura TEXT
   );`,
  `CREATE TABLE IF NOT EXISTS fechamentos_caixa (
     id_fechamento TEXT PRIMARY KEY,
     fechado_em TEXT NOT NULL,
     relatorio_json TEXT NOT NULL
   );`,
];
