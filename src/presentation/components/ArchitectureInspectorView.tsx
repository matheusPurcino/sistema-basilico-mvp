import React from 'react';
import type { EstadoMaquina, EventoOutbox, RegistroAuditoria, SubEstadoOffline } from '../../domain';
import type { TransacaoNuvem } from '../../infrastructure';
import { AcademicBadge, IconInspector, IconShield } from './Icons';

export interface ArchitectureInspectorViewProps {
  estadoMaquina: EstadoMaquina;
  subEstadoOffline: SubEstadoOffline;
  outboxEventos: EventoOutbox[];
  outboxPendentes: number;
  transacoesNuvem: TransacaoNuvem[];
  auditLogs: RegistroAuditoria[];
  statsSqlite: {
    ultimoSeq: number;
    framesNoWal: number;
    bytesArmazenados: number;
    amostraCifradaHex: string;
  };
  statsNuvem: {
    totalTransacoes: number;
    lotesProcessados: number;
    rollbacksRealizados: number;
    duplicatasDescartadasTotal: number;
  };
  modoAvaliador: boolean;
  onReenviarUltimoLoteIdempotencia: () => void;
  onExecutarAnonimizacaoLgpd: () => void;
}

export function ArchitectureInspectorView({
  estadoMaquina,
  subEstadoOffline,
  outboxEventos,
  outboxPendentes,
  transacoesNuvem,
  auditLogs,
  statsSqlite,
  statsNuvem,
  modoAvaliador,
  onReenviarUltimoLoteIdempotencia,
  onExecutarAnonimizacaoLgpd,
}: ArchitectureInspectorViewProps): React.ReactElement {
  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════════════════════════════════════
          1. PIPELINE VISUAL: SQLite (WAL) -> SyncWorker -> PostgreSQL Cloud
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="basilico-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#1E1B18] text-[#E86F2C] flex items-center justify-center">
              <IconInspector size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-[#23201E]">
                  Auditoria &amp; Sincronização Híbrida
                </h2>
                <AcademicBadge codigo="RNF01 · RNF02 · CT07 · CT08 · CT10 · CT13" visivel={modoAvaliador} />
              </div>
              <p className="text-xs text-[#6E655F]">
                Arquitetura Transactional Outbox com criptografia local AES-256-GCM e deduplicação remota por UUID v4.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-[#23201E] font-bold">
              Máquina: <span className="text-[#E86F2C]">{estadoMaquina}</span>
              {subEstadoOffline ? ` (${subEstadoOffline})` : ''}
            </span>
          </div>
        </div>

        {/* Diagrama de Fluxo Arquitetural em 3 Estágios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-[#FAF6EE] border border-[#E6DEC8]">
          {/* Estágio 1: SQLite Local */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E6DEC8] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold text-[#23201E]">
                <span>1. SQLite Local (WAL + AES-256)</span>
                <span className="px-2 py-0.5 rounded bg-[#EEF7E6] text-[#4E8C22] font-mono text-[10px]">
                  RPO = 0
                </span>
              </div>
              <p className="text-[11px] text-[#6E655F] mt-1">
                Grava vendas e enfileira eventos na tabela <code className="font-mono">outbox_events</code> na mesma transação ACID.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#F2E9D8] flex justify-between text-[11px] font-mono text-[#6E655F]">
              <span>WAL Seq #{statsSqlite.ultimoSeq}</span>
              <span>{(statsSqlite.bytesArmazenados / 1024).toFixed(1)} KB cifrados</span>
            </div>
          </div>

          {/* Estágio 2: SyncWorker */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E6DEC8] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold text-[#23201E]">
                <span>2. SyncWorker Assíncrono</span>
                <span className="px-2 py-0.5 rounded bg-[#FFF0E6] text-[#E86F2C] font-mono text-[10px]">
                  FIFO + Backoff
                </span>
              </div>
              <p className="text-[11px] text-[#6E655F] mt-1">
                Drena lotes em ordem cronológica estrita com retentativa exponencial (2s, 4s, 8s… até 60s) e Dead-Letter.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#F2E9D8] flex justify-between text-[11px] font-mono text-[#6E655F]">
              <span>Fila atual: {outboxPendentes}</span>
              <span>Lotes enviados: {statsNuvem.lotesProcessados}</span>
            </div>
          </div>

          {/* Estágio 3: PostgreSQL Nuvem */}
          <div className="p-3.5 rounded-xl bg-white border border-[#E6DEC8] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-extrabold text-[#23201E]">
                <span>3. PostgreSQL Nuvem</span>
                <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-800 border border-sky-200 font-mono text-[10px]">
                  UUID v4 Idempotente
                </span>
              </div>
              <p className="text-[11px] text-[#6E655F] mt-1">
                Transação atômica por lote (rollback integral se a conexão cair no meio) e descarte de UUIDs repetidos.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[#F2E9D8] flex justify-between text-[11px] font-mono text-[#6E655F]">
              <span>Rollbacks: {statsNuvem.rollbacksRealizados}</span>
              <span>Duplicatas: {statsNuvem.duplicatasDescartadasTotal}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          2. TABELAS LADO A LADO: SQLITE OUTBOX LOCAL <-> POSTGRESQL NUVEM
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Coluna Esquerda: SQLite Outbox Local */}
        <div className="basilico-card rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 bg-[#1E1B18] text-[#F7F3EB] flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E86F2C]" />
                <h3 className="text-sm font-extrabold">
                  SQLite Local · <code className="font-mono text-[#FFB685]">outbox_events</code>
                </h3>
              </div>
              <p className="text-[11px] text-[#B8AEA2] mt-0.5 font-mono truncate max-w-md">
                Ciphertext AES-256-GCM: {statsSqlite.amostraCifradaHex || 'aguardando checkpoint'}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#2A2521] border border-[#3E362E] font-mono text-xs font-bold text-[#F7F3EB]">
              {outboxEventos.length} reg.
            </span>
          </div>

          <div className="p-4 flex-1 max-h-80 overflow-y-auto">
            {outboxEventos.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#6E655F]">
                Nenhum evento na Outbox local ainda. Realize uma venda no PDV para gerar eventos.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E6DEC8] text-[10px] font-extrabold uppercase tracking-wider text-[#6E655F]">
                    <th className="py-2 pr-2">Seq</th>
                    <th className="py-2 px-2">Tipo</th>
                    <th className="py-2 px-2">UUID v4</th>
                    <th className="py-2 pl-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2E9D8] font-mono text-[11px]">
                  {outboxEventos.map((ev) => (
                    <tr key={ev.idEvento} className="hover:bg-[#FAF6EE]">
                      <td className="py-2.5 pr-2 font-bold text-[#23201E]">#{ev.seq}</td>
                      <td className="py-2.5 px-2 font-semibold text-[#23201E]">{ev.tipo}</td>
                      <td className="py-2.5 px-2 text-[#6E655F] truncate max-w-[140px]" title={ev.idEvento}>
                        {ev.idEvento.slice(0, 13)}…
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ev.status === 'SINCRONIZADO'
                              ? 'bg-[#EEF7E6] text-[#4E8C22]'
                              : ev.status === 'DEAD_LETTER'
                                ? 'bg-red-100 text-[#DC2626]'
                                : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {ev.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Coluna Direita: PostgreSQL Nuvem */}
        <div className="basilico-card rounded-2xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 bg-[#1E1B18] text-[#F7F3EB] flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7AC13A]" />
                <h3 className="text-sm font-extrabold">
                  PostgreSQL Nuvem · <code className="font-mono text-[#7AC13A]">cloud_transactions</code>
                </h3>
              </div>
              <p className="text-[11px] text-[#B8AEA2] mt-0.5 font-mono">
                Confirmadas: {statsNuvem.totalTransacoes} · Duplicatas barradas: {statsNuvem.duplicatasDescartadasTotal}
              </p>
            </div>

            <button
              type="button"
              onClick={onReenviarUltimoLoteIdempotencia}
              className="px-3 py-1.5 rounded-xl bg-[#E86F2C] hover:bg-[#D45D1B] text-white text-xs font-bold shadow-xs transition cursor-pointer"
              title="Reenvia propositalmente o último lote já confirmado para comprovar que o PostgreSQL descarta duplicatas por UUID v4 (CT08)"
            >
              🔁 Reenviar Último Lote (Idempotência)
            </button>
          </div>

          <div className="p-4 flex-1 max-h-80 overflow-y-auto">
            {transacoesNuvem.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#6E655F]">
                Nenhuma transação sincronizada na nuvem ainda.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E6DEC8] text-[10px] font-extrabold uppercase tracking-wider text-[#6E655F]">
                    <th className="py-2 pr-2">Origem</th>
                    <th className="py-2 px-2">Tipo</th>
                    <th className="py-2 px-2">UUID v4 (Unique Key)</th>
                    <th className="py-2 pl-2 text-right">Estado Remoto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2E9D8] font-mono text-[11px]">
                  {transacoesNuvem.map((t) => (
                    <tr key={t.idEvento} className="hover:bg-[#FAF6EE]">
                      <td className="py-2.5 pr-2 font-bold text-[#23201E]">Seq #{t.seqOrigem}</td>
                      <td className="py-2.5 px-2 font-semibold text-[#23201E]">{t.tipo}</td>
                      <td className="py-2.5 px-2 text-[#6E655F] truncate max-w-[140px]" title={t.idEvento}>
                        {t.idEvento.slice(0, 13)}…
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-[#EEF7E6] text-[#4E8C22] text-[10px] font-bold">
                          COMMITTED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          3. GOVERNANÇA LGPD (RE01 / CT05) & TRILHA DE AUDITORIA IMUTÁVEL
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="basilico-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#F2E9D8]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#EEF7E6] text-[#4E8C22] flex items-center justify-center shrink-0 mt-0.5">
              <IconShield size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xl font-bold text-[#23201E]">
                  Privacidade LGPD &amp; Trilha de Auditoria Imutável
                </h3>
                <AcademicBadge codigo="RE01 · CT05 · audit_logs" visivel={modoAvaliador} />
              </div>
              <p className="text-xs text-[#6E655F] mt-0.5">
                Anonimiza dados pessoais (nome, telefone e endereço) de pedidos com mais de 180 dias sem alterar os valores fiscais.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onExecutarAnonimizacaoLgpd}
            className="px-4 py-2.5 rounded-xl bg-[#1E1B18] hover:bg-[#332D27] text-[#F7F3EB] font-extrabold text-xs shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            <span>🔒 Executar Rotina de Anonimização LGPD (180 dias)</span>
          </button>
        </div>

        {/* Tabela de Logs de Auditoria Imutáveis */}
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E6DEC8] text-[10px] font-extrabold uppercase tracking-wider text-[#6E655F]">
                <th className="py-2 pr-3">Categoria</th>
                <th className="py-2 px-3">Evento / Ação</th>
                <th className="py-2 px-3">Detalhes Técnicos</th>
                <th className="py-2 pl-3 text-right">Operador &amp; Horário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2E9D8] text-[11px]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#FAF6EE]">
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded-md bg-[#F2E9D8] text-[#23201E] font-mono font-bold text-[10px]">
                      {log.categoria}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-[#E86F2C] whitespace-nowrap">
                    {log.acao}
                  </td>
                  <td className="py-2.5 px-3 text-[#23201E]">{log.detalhes}</td>
                  <td className="py-2.5 pl-3 text-right font-mono text-[#6E655F] whitespace-nowrap">
                    {log.usuario} · {new Date(log.dataHora).toLocaleTimeString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
