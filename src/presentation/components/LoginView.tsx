import React from 'react';
import { formatarBRL } from '../../domain';
import { CREDENCIAIS_HOMOLOGACAO } from '../../infrastructure';
import { BrandLogo } from './BrandLogo';
import { AcademicBadge, IconGraduation, IconShield } from './Icons';

export interface LoginViewProps {
  loginInput: string;
  senhaInput: string;
  erroLogin: string | null;
  bloqueadaInatividade: boolean;
  itensSalvosCarrinho: number;
  totalSalvoCarrinhoCentavos: number;
  modoAvaliador: boolean;
  onToggleModoAvaliador: () => void;
  onChangeLogin: (val: string) => void;
  onChangeSenha: (val: string) => void;
  onSubmitLogin: (e: React.FormEvent) => void;
  onAcessoRapido: (perfil: 'OPERADOR' | 'GERENTE', logarDireto: boolean) => void;
}

export function LoginView({
  loginInput,
  senhaInput,
  erroLogin,
  bloqueadaInatividade,
  itensSalvosCarrinho,
  totalSalvoCarrinhoCentavos,
  modoAvaliador,
  onToggleModoAvaliador,
  onChangeLogin,
  onChangeSenha,
  onSubmitLogin,
  onAcessoRapido,
}: LoginViewProps): React.ReactElement {
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#FAF6EE] text-[#23201E]">
      {/* ═══════════════════════════════════════════════════════════════════════
          LADO ESQUERDO: HERÓI INSTITUCIONAL EM ESPRESSO ESCURO (#1E1B18)
      ═══════════════════════════════════════════════════════════════════════ */}
      <aside className="lg:col-span-5 xl:col-span-5 espresso-hero-pattern text-[#F7F3EB] p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden border-b lg:border-b-0 lg:border-r border-[#332D27]">
        {/* Topo Institucional */}
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2A2521] border border-[#3E362E] text-xs font-medium text-[#E5DAC8]">
            <span className="w-2 h-2 rounded-full bg-[#5CA329] shadow-[0_0_8px_#5CA329]" />
            <span>Terminal PDV Híbrido · Pouso Alegre, MG</span>
          </div>

          <button
            type="button"
            onClick={onToggleModoAvaliador}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition cursor-pointer ${
              modoAvaliador
                ? 'bg-[#E86F2C] text-white border-[#E86F2C] shadow-sm'
                : 'bg-[#2A2521] text-[#C8BEB0] border-[#3E362E] hover:border-[#6E655F]'
            }`}
          >
            <IconGraduation size={14} />
            <span>Modo Avaliador UNIFEI: {modoAvaliador ? 'ON' : 'OFF'}</span>
          </button>
        </div>

        {/* Centro: Medalhão Oficial Basílico + Identidade */}
        <div className="my-10 lg:my-auto flex flex-col items-start">
          <BrandLogo size="xl" className="mb-6 shadow-2xl" />

          <span className="text-xs font-bold uppercase tracking-[0.22em] text-[#E86F2C] mb-2">
            Cucina Artigianale &amp; Trattoria
          </span>
          <h1 className="font-display text-4xl xl:text-5xl font-bold italic text-[#F7F3EB] tracking-tight leading-tight">
            Restaurante Basílico
          </h1>
          <p className="mt-3 text-base text-[#D1C7B8] leading-relaxed max-w-md">
            Tradição Italiana &amp; Operação Resiliente — Pouso Alegre, MG
          </p>

          {/* Indicadores de Proteção Local & Carrinho Salvo */}
          <div className="mt-8 w-full max-w-md space-y-3">
            <div className="p-4 rounded-2xl bg-[#28231F]/90 border border-[#3D352E] flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-[#4E8C22]/20 border border-[#5CA329]/40 flex items-center justify-center text-[#7AC13A] shrink-0 mt-0.5">
                <IconShield size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#F7F3EB]">
                    Motor Local Offline-First Ativo
                  </span>
                  <AcademicBadge codigo="RNF01 · AES-256" visivel={modoAvaliador} variante="dark" />
                </div>
                <p className="text-xs text-[#B8AEA2] mt-1 leading-relaxed">
                  {modoAvaliador
                    ? 'Banco SQLite em modo WAL com criptografia autenticada AES-256-GCM (PBKDF2 120.000 iterações).'
                    : 'Operação contínua mesmo sem internet. Todas as vendas e comandas ficam protegidas neste terminal.'}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#28231F]/90 border border-[#3D352E] flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#D1C7B8]">
                    {modoAvaliador ? 'Comanda Persistida no WAL (RPO = 0)' : 'Comanda Recuperada no Terminal'}
                  </span>
                  <AcademicBadge codigo="CT12" visivel={modoAvaliador} variante="dark" />
                </div>
                <p className="text-[11px] text-[#968B82] mt-0.5">
                  Protegida contra fechamento acidental ou queda elétrica
                </p>
              </div>
              <div className="text-right font-mono">
                <div className="text-sm font-bold text-[#7AC13A]">
                  {formatarBRL(totalSalvoCarrinhoCentavos)}
                </div>
                <div className="text-[11px] text-[#B8AEA2]">{itensSalvosCarrinho} item(ns)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé Institucional */}
        <div className="pt-4 border-t border-[#332D27] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#968B82]">
          <span>Sistema Basílico POS · Edição Comercial v2.0</span>
          <span>UNIFEI · ECOT11A · Matheus Gouveia Purcino (2024006907)</span>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════════
          LADO DIREITO: FORMULÁRIO SOBRE FUNDO PERGAMINHO (#FAF6EE)
      ═══════════════════════════════════════════════════════════════════════ */}
      <main className="lg:col-span-7 xl:col-span-7 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md">
          {/* Cabeçalho de Boas-Vindas */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#E86F2C]">
                Acesso ao Ponto de Venda
              </span>
              <AcademicBadge codigo="RF01 · RBAC · CT03" visivel={modoAvaliador} />
            </div>
            <h2 className="font-display text-3xl font-bold text-[#23201E]">
              Bem-vindo ao turno
            </h2>
            <p className="text-sm text-[#6E655F] mt-1">
              Identifique-se para abrir o balcão, gerenciar pedidos do delivery ou auditar o caixa.
            </p>
          </div>

          {/* Alerta de Sessão Bloqueada por Inatividade */}
          {bloqueadaInatividade && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3 shadow-sm">
              <span className="text-lg leading-none">⏱️</span>
              <div>
                <div className="font-bold text-amber-950 flex items-center gap-2">
                  <span>Terminal bloqueado por inatividade (30 min)</span>
                  <AcademicBadge codigo="RNF05.3 / CT04" visivel={modoAvaliador} variante="amber" />
                </div>
                <p className="mt-1 text-amber-800 leading-relaxed">
                  Por segurança, sua sessão foi suspensa após 30 minutos sem uso. Faça login para retomar exatamente de onde parou.
                </p>
              </div>
            </div>
          )}

          {/* Alerta de Erro de Credencial */}
          {erroLogin && (
            <div
              role="alert"
              className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs font-medium flex items-center gap-2.5 shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-[#DC2626] shrink-0" />
              <span>{erroLogin}</span>
            </div>
          )}

          {/* Card Principal de Login */}
          <div className="basilico-card rounded-2xl p-6 sm:p-7">
            <form onSubmit={onSubmitLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#23201E] mb-1.5">
                  Operador ou E-mail Corporativo
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#6E655F] pointer-events-none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={loginInput}
                    onChange={(e) => onChangeLogin(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-sm text-[#23201E] font-medium focus:outline-none focus:border-[#E86F2C] focus:ring-2 focus:ring-[#E86F2C]/20 transition"
                    placeholder="operador ou gerente"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-[#23201E]">
                    Senha de Acesso
                  </label>
                  {modoAvaliador && (
                    <span className="text-[10px] font-mono text-[#6E655F]">
                      bcrypt (cost 12) · Cache Local
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#6E655F] pointer-events-none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    type="password"
                    value={senhaInput}
                    onChange={(e) => onChangeSenha(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-sm text-[#23201E] font-medium focus:outline-none focus:border-[#E86F2C] focus:ring-2 focus:ring-[#E86F2C]/20 transition"
                    placeholder="••••••••••••"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-5 rounded-xl bg-[#E86F2C] hover:bg-[#D45D1B] active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-[#E86F2C]/25 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Entrar no Terminal</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            </form>
          </div>

          {/* Seção Inferior: Acesso Rápido para Avaliação (1 Clique) */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#6E655F]">
                Acesso Rápido para Avaliação
              </span>
              <span className="text-[11px] text-[#968B82]">Clique para entrar com 1 clique</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Card Operador de Caixa */}
              <button
                type="button"
                onClick={() => onAcessoRapido('OPERADOR', true)}
                className="basilico-card-interactive rounded-2xl p-3.5 text-left flex items-start gap-3 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#FFF0E6] border border-[#F5D0B8] text-[#E86F2C] flex items-center justify-center shrink-0 group-hover:bg-[#E86F2C] group-hover:text-white transition">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="20" height="14" x="2" y="5" rx="2" />
                    <line x1="2" x2="22" y1="10" y2="10" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#23201E] group-hover:text-[#E86F2C] transition">
                    Operador de Caixa
                  </div>
                  <div className="text-[11px] text-[#6E655F] truncate">
                    PDV, Balcão e Delivery
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-[#968B82]">
                    {CREDENCIAIS_HOMOLOGACAO.operador.login}
                  </div>
                </div>
              </button>

              {/* Card Gerente de Loja */}
              <button
                type="button"
                onClick={() => onAcessoRapido('GERENTE', true)}
                className="basilico-card-interactive rounded-2xl p-3.5 text-left flex items-start gap-3 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EEF7E6] border border-[#C6E3B0] text-[#4E8C22] flex items-center justify-center shrink-0 group-hover:bg-[#4E8C22] group-hover:text-white transition">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#23201E] group-hover:text-[#4E8C22] transition">
                    Gerente de Loja
                  </div>
                  <div className="text-[11px] text-[#6E655F] truncate">
                    Acesso Total + Estornos
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-[#968B82]">
                    {CREDENCIAIS_HOMOLOGACAO.gerente.login}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
