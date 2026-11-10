import React, { useMemo, useState } from 'react';
import {
  formatarBRL,
  type EventoCompensatorio,
  type RelatorioFechamento,
  type Venda,
} from '../../domain';
import { AcademicBadge, IconCashier } from './Icons';

export interface CashierHistoryViewProps {
  caixaAberto: boolean;
  saldoAtualCentavos: number;
  saldoInicialCentavos: number;
  operadorAbertura: string | null;
  outboxPendentes: number;
  vendas: Venda[];
  eventosCompensatorios: EventoCompensatorio[];
  ultimoFechamento: RelatorioFechamento | null;
  saldoAberturaReais: string;
  modoAvaliador: boolean;
  onChangeSaldoAbertura: (val: string) => void;
  onAbrirCaixa: () => void;
  onFecharCaixa: () => void;
  onSolicitarEstorno: (idVenda: string) => void;
}

type FiltroVendas = 'TODAS' | 'SINCRONIZADAS' | 'PENDENTES' | 'ESTORNADAS';

export function CashierHistoryView({
  caixaAberto,
  saldoAtualCentavos,
  saldoInicialCentavos,
  operadorAbertura,
  outboxPendentes,
  vendas,
  eventosCompensatorios,
  ultimoFechamento,
  saldoAberturaReais,
  modoAvaliador,
  onChangeSaldoAbertura,
  onAbrirCaixa,
  onFecharCaixa,
  onSolicitarEstorno,
}: CashierHistoryViewProps): React.ReactElement {
  const [filtro, setFiltro] = useState<FiltroVendas>('TODAS');

  const kpis = useMemo(() => {
    const totalVendidoBruto = vendas.reduce((acc, v) => acc + v.getValorTotalCentavos(), 0);
    const totalEstornado = eventosCompensatorios.reduce(
      (acc, ev) => acc + ev.valorEstornadoCentavos,
      0,
    );
    const qtdPendentesVendas = vendas.filter((v) => !v.isSincronizado()).length;
    return { totalVendidoBruto, totalEstornado, qtdPendentesVendas };
  }, [vendas, eventosCompensatorios]);

  const vendasFiltradas = useMemo(() => {
    return vendas.filter((v) => {
      if (filtro === 'SINCRONIZADAS') return v.isSincronizado() && !v.isEstornada();
      if (filtro === 'PENDENTES') return !v.isSincronizado();
      if (filtro === 'ESTORNADAS') return v.isEstornada();
      return true;
    });
  }, [vendas, filtro]);

  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════════════════════════════════════
          1. CARDS DE RESUMO FINANCEIRO NO TOPO (KPIs DO TURNO)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Saldo Atual em Caixa */}
        <div className="basilico-card rounded-2xl p-4 border-l-4 border-l-[#4E8C22]">
          <div className="flex items-center justify-between text-xs text-[#6E655F] font-bold">
            <span>Saldo Atual em Caixa</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                caixaAberto ? 'bg-[#EEF7E6] text-[#4E8C22]' : 'bg-red-50 text-[#DC2626]'
              }`}
            >
              {caixaAberto ? 'TURNO ABERTO' : 'FECHADO'}
            </span>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#23201E]">
            {formatarBRL(saldoAtualCentavos)}
          </div>
          <div className="mt-1 text-[11px] text-[#6E655F] font-mono">
            Fundo inicial: {formatarBRL(saldoInicialCentavos)}
          </div>
        </div>

        {/* KPI 2: Total Vendido no Turno */}
        <div className="basilico-card rounded-2xl p-4 border-l-4 border-l-[#E86F2C]">
          <div className="flex items-center justify-between text-xs text-[#6E655F] font-bold">
            <span>Total Vendido no Turno</span>
            <span className="font-mono text-[11px] text-[#E86F2C] font-extrabold">
              {vendas.length} venda(s)
            </span>
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#23201E]">
            {formatarBRL(kpis.totalVendidoBruto)}
          </div>
          <div className="mt-1 text-[11px] text-[#6E655F]">
            Receita bruta presencial acumulada
          </div>
        </div>

        {/* KPI 3: Vendas Pendentes de Sincronização (Outbox) */}
        <div className="basilico-card rounded-2xl p-4 border-l-4 border-l-[#D97706]">
          <div className="flex items-center justify-between text-xs text-[#6E655F] font-bold">
            <span>Pendentes na Outbox</span>
            <AcademicBadge codigo="RN04" visivel={modoAvaliador} variante="amber" />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#D97706]">
            {outboxPendentes} evento(s)
          </div>
          <div className="mt-1 text-[11px] text-[#6E655F]">
            {outboxPendentes === 0
              ? '100% sincronizado com a nuvem'
              : 'Aguardando reconexão WAN para envio'}
          </div>
        </div>

        {/* KPI 4: Total Estornado */}
        <div className="basilico-card rounded-2xl p-4 border-l-4 border-l-[#DC2626]">
          <div className="flex items-center justify-between text-xs text-[#6E655F] font-bold">
            <span>Total Estornado</span>
            <AcademicBadge codigo="RN02 / RBAC" visivel={modoAvaliador} />
          </div>
          <div className="mt-2 font-mono text-2xl font-extrabold text-[#DC2626]">
            {formatarBRL(kpis.totalEstornado)}
          </div>
          <div className="mt-1 text-[11px] text-[#6E655F]">
            {eventosCompensatorios.length} evento(s) compensatório(s)
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          2. CONTROLE DE TURNO (ABRIR / FECHAR CAIXA) & DOCUMENTO CONTÁBIL RN04
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="basilico-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F2E9D8] text-[#23201E] flex items-center justify-center shrink-0 mt-0.5">
              <IconCashier size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-xl font-bold text-[#23201E]">
                  Controle de Turno e Fechamento de Caixa
                </h2>
                <AcademicBadge codigo="RN04 · CT11" visivel={modoAvaliador} />
              </div>
              <p className="text-xs text-[#6E655F] mt-0.5">
                {caixaAberto
                  ? `Turno aberto por "${operadorAbertura ?? 'sistema'}". Caso feche sem internet, as pendências locais serão preservadas com ressalva contábil.`
                  : 'O caixa encontra-se fechado. Informe o fundo de troco inicial para iniciar um novo turno de vendas.'}
              </p>
            </div>
          </div>

          {caixaAberto ? (
            <button
              type="button"
              onClick={onFecharCaixa}
              className="px-4 py-2.5 rounded-xl bg-[#1E1B18] hover:bg-[#332D27] text-[#F7F3EB] font-extrabold text-xs shadow-sm transition cursor-pointer"
            >
              🔒 Encerrar Turno e Emitir Relatório Contábil
              {outboxPendentes > 0 ? ` (${outboxPendentes} na fila)` : ''}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-mono text-[#6E655F]">
                  R$
                </span>
                <input
                  type="text"
                  value={saldoAberturaReais}
                  onChange={(e) => onChangeSaldoAbertura(e.target.value)}
                  className="w-32 pl-9 pr-3 py-2 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-xs font-mono font-bold text-[#23201E]"
                  placeholder="250,00"
                />
              </div>
              <button
                type="button"
                onClick={onAbrirCaixa}
                className="px-4 py-2.5 rounded-xl bg-[#4E8C22] hover:bg-[#3E7319] text-white font-extrabold text-xs shadow-sm transition cursor-pointer"
              >
                ✓ Abrir Novo Turno
              </button>
            </div>
          )}
        </div>

        {/* Documento Contábil de Fechamento de Turno */}
        {ultimoFechamento && (
          <div
            className={`mt-5 p-5 rounded-2xl border-2 ${
              ultimoFechamento.alertaPendencia
                ? 'bg-amber-50/90 border-[#D97706] text-amber-950'
                : 'bg-[#FAF6EE] border-[#E6DEC8] text-[#23201E]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#D5C8AE]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#6E655F] block">
                  Demonstrativo Contábil de Encerramento de Turno
                </span>
                <h3 className="text-sm font-extrabold flex items-center gap-2 mt-0.5">
                  <span>Fechamento #{ultimoFechamento.idFechamento.slice(0, 8)}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      ultimoFechamento.modo === 'ONLINE'
                        ? 'bg-[#EEF7E6] text-[#4E8C22]'
                        : 'bg-amber-200 text-amber-950'
                    }`}
                  >
                    MODO {ultimoFechamento.modo}
                  </span>
                </h3>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase tracking-wider text-[#6E655F] block">
                  Saldo Final Apurado
                </span>
                <span className="font-mono text-lg font-extrabold text-[#4E8C22]">
                  {formatarBRL(ultimoFechamento.saldoFinalCentavos)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3 text-xs">
              <div className="p-2.5 rounded-xl bg-white/80 border border-[#E6DEC8]">
                <span className="text-[11px] text-[#6E655F] block">Fundo Inicial</span>
                <strong className="font-mono">{formatarBRL(ultimoFechamento.saldoInicialCentavos)}</strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 border border-[#E6DEC8]">
                <span className="text-[11px] text-[#6E655F] block">Vendas Brutas ({ultimoFechamento.quantidadeVendas})</span>
                <strong className="font-mono text-[#4E8C22]">
                  +{formatarBRL(ultimoFechamento.totalVendasBrutoCentavos)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 border border-[#E6DEC8]">
                <span className="text-[11px] text-[#6E655F] block">Estornos ({ultimoFechamento.quantidadeEstornos})</span>
                <strong className="font-mono text-[#DC2626]">
                  −{formatarBRL(ultimoFechamento.totalEstornosCentavos)}
                </strong>
              </div>
              <div className="p-2.5 rounded-xl bg-white/80 border border-[#E6DEC8]">
                <span className="text-[11px] text-[#6E655F] block">Fila Local (Outbox)</span>
                <strong className="font-mono text-[#D97706]">
                  {ultimoFechamento.pendenciasOutbox} pendente(s)
                </strong>
              </div>
            </div>

            {ultimoFechamento.ressalvas.length > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-amber-100 border border-amber-400 text-xs text-amber-950">
                <div className="font-extrabold mb-1 flex items-center gap-1.5">
                  <span>⚠️ Ressalva de Fechamento Offline</span>
                  <AcademicBadge codigo="RN04 / CT11" visivel={modoAvaliador} variante="amber" />
                </div>
                <ul className="list-disc list-inside space-y-1 text-amber-900">
                  {ultimoFechamento.ressalvas.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          3. TABELA / LISTA MODERNA DE VENDAS & ESTORNO RBAC
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="basilico-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#F2E9D8]">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-xl font-bold text-[#23201E]">
                Histórico de Vendas &amp; Estornos
              </h3>
              <AcademicBadge codigo="RN02 · RBAC · CT02" visivel={modoAvaliador} />
            </div>
            <p className="text-xs text-[#6E655F] mt-0.5">
              {modoAvaliador
                ? 'O estorno exige autorização de GERENTE e nunca executa DELETE: cria um EventoCompensatorio imutável.'
                : 'Consulte todas as vendas do turno. Estornos requerem senha de Gerente e ficam registrados para auditoria.'}
            </p>
          </div>

          {/* Filtros Rápidos */}
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'TODAS', label: 'Todas' },
                { id: 'SINCRONIZADAS', label: 'Sincronizadas' },
                { id: 'PENDENTES', label: 'Pendentes Offline' },
                { id: 'ESTORNADAS', label: 'Estornadas' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltro(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  filtro === f.id
                    ? 'bg-[#E86F2C] text-white border-[#E86F2C]'
                    : 'bg-[#FAF6EE] hover:bg-[#F2E9D8] text-[#23201E] border-[#E6DEC8]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de Vendas */}
        {vendasFiltradas.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-2xl mb-2">🧾</div>
            <p className="text-xs font-bold text-[#23201E]">Nenhuma venda encontrada neste filtro</p>
            <p className="text-[11px] text-[#6E655F] mt-0.5">
              Finalize uma venda na aba Frente de Caixa (PDV) para visualizá-la aqui.
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {vendasFiltradas.map((v) => {
              const estornada = v.isEstornada();
              const sincronizada = v.isSincronizado();

              return (
                <div
                  key={v.getIdVenda()}
                  className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 transition ${
                    estornada
                      ? 'bg-red-50/40 border-red-200'
                      : 'bg-[#FAF6EE] border-[#E6DEC8] hover:border-[#D5C8AE]'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-extrabold text-sm text-[#23201E]">
                        Venda #{String(v.getNumeroSequencial()).padStart(4, '0')}
                      </span>

                      <span className="px-2.5 py-0.5 rounded-md bg-white border border-[#E6DEC8] font-mono font-bold text-[11px] text-[#23201E]">
                        {v.getMetodoPagamento()}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full font-extrabold text-[10px] ${
                          sincronizada
                            ? 'bg-[#EEF7E6] text-[#4E8C22] border border-[#4E8C22]/30'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        {sincronizada ? '🟢 Sincronizada' : '🟠 Pendente Offline (Outbox)'}
                      </span>

                      {estornada && (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-[#DC2626] border border-red-300 font-extrabold text-[10px]">
                          ESTORNADA
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[#6E655F] flex flex-wrap items-center gap-2">
                      <span>
                        {v
                          .getItens()
                          .map((i) => `${i.getQuantidade()}x ${i.getNomeProduto()}`)
                          .join(', ')}
                      </span>
                    </div>

                    <div className="text-[11px] text-[#968B82] font-mono">
                      Horário: {new Date(v.getDataHora()).toLocaleTimeString('pt-BR')} · UUID: {v.getIdVenda()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div
                        className={`font-mono font-extrabold text-base ${
                          estornada ? 'line-through text-[#968B82]' : 'text-[#23201E]'
                        }`}
                      >
                        {formatarBRL(v.getValorTotalCentavos())}
                      </div>
                      {v.getDescontoCentavos() > 0 && (
                        <div className="text-[10px] font-mono text-[#D97706]">
                          Desc: −{formatarBRL(v.getDescontoCentavos())}
                        </div>
                      )}
                    </div>

                    {!estornada && (
                      <button
                        type="button"
                        onClick={() => onSolicitarEstorno(v.getIdVenda())}
                        className="px-3.5 py-2 rounded-xl bg-white hover:bg-red-50 border border-red-300 text-[#DC2626] font-bold text-xs shadow-2xs transition cursor-pointer"
                      >
                        Estornar Venda
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Razão Contábil de Eventos Compensatórios (RN02) */}
        {eventosCompensatorios.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[#E6DEC8]">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#23201E]">
                Livro Razão de Eventos Compensatórios (Estornos Imutáveis)
              </h4>
              <AcademicBadge codigo="RN02" visivel={modoAvaliador} />
            </div>

            <div className="space-y-2">
              {eventosCompensatorios.map((ev) => (
                <div
                  key={ev.idEvento}
                  className="p-3.5 rounded-xl bg-red-50/70 border border-red-200 text-xs flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <span className="font-mono font-bold text-[#DC2626]">
                      Evento #{ev.idEvento.slice(0, 8)}
                    </span>{' '}
                    <span className="text-[#23201E]">
                      anula contabilmente a <strong>Venda #{String(ev.numeroVendaOriginal).padStart(4, '0')}</strong>
                    </span>
                    <div className="text-[#6E655F] mt-0.5">
                      Motivo: <em>&ldquo;{ev.motivo}&rdquo;</em> · Autorizado por:{' '}
                      <strong className="uppercase">{ev.autorizadoPor}</strong>
                    </div>
                  </div>
                  <div className="font-mono font-extrabold text-sm text-[#DC2626]">
                    −{formatarBRL(ev.valorEstornadoCentavos)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
