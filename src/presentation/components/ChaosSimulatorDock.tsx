import React, { useState } from 'react';
import type { Plataforma } from '../../domain';

export interface ChaosSimulatorDockProps {
  wanOnline: boolean;
  possuiPapel: boolean;
  corteToxiproxyAtivo: boolean;
  onToggleWan: () => void;
  onToggleBobina: () => void;
  onToggleToxiproxy: () => void;
  onInjetarPedido: (plataforma: Plataforma, duplicado?: boolean) => void;
  onSimularQuedaEletrica: () => void;
  onResetarBancoDemo: () => void;
}

export function ChaosSimulatorDock({
  wanOnline,
  possuiPapel,
  corteToxiproxyAtivo,
  onToggleWan,
  onToggleBobina,
  onToggleToxiproxy,
  onInjetarPedido,
  onSimularQuedaEletrica,
  onResetarBancoDemo,
}: ChaosSimulatorDockProps): React.ReactElement {
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="fixed bottom-3 inset-x-0 z-40 flex flex-col items-center pointer-events-none px-4">
      {/* Gaveta Expandida (Estilo DevTools Moderna em Espresso #1E1B18) */}
      {expandido && (
        <div className="pointer-events-auto w-full max-w-5xl mb-2 rounded-2xl bg-[#1E1B18]/98 border border-[#3E362E] text-[#F7F3EB] p-4 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-[#332D27]">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-[#E86F2C] text-white font-extrabold text-[11px] uppercase tracking-wider">
                🧪 Laboratório de Caos &amp; Simulação (ECOT11A)
              </span>
              <span className="text-xs text-[#B8AEA2]">
                Injete falhas físicas, quedas de rede e eventos de delivery em tempo real:
              </span>
            </div>

            <button
              type="button"
              onClick={() => setExpandido(false)}
              className="px-2.5 py-1 rounded-lg bg-[#2A2521] hover:bg-[#3A322B] text-xs font-bold text-[#D1C7B8] cursor-pointer"
            >
              Recolher ▼
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Rede WAN */}
            <button
              type="button"
              onClick={onToggleWan}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                wanOnline
                  ? 'bg-[#4E8C22]/20 border-[#5CA329]/50 text-[#9BE862] hover:bg-[#4E8C22]/30'
                  : 'bg-red-950 border-red-500 text-red-200 hover:bg-red-900'
              }`}
            >
              🌐 Rede WAN: {wanOnline ? 'Online' : 'Offline (Queda de Internet)'}
            </button>

            {/* 2. Impressora 9100 Sem Papel */}
            <button
              type="button"
              onClick={onToggleBobina}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                possuiPapel
                  ? 'bg-[#4E8C22]/20 border-[#5CA329]/50 text-[#9BE862] hover:bg-[#4E8C22]/30'
                  : 'bg-amber-950 border-amber-500 text-amber-200 hover:bg-amber-900'
              }`}
            >
              🖨️ Impressora 9100: {possuiPapel ? 'Com Bobina (OK)' : 'Sem Papel (RN03)'}
            </button>

            {/* 3. Corte de Lote Toxiproxy */}
            <button
              type="button"
              onClick={onToggleToxiproxy}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
                !corteToxiproxyAtivo
                  ? 'bg-[#2A2521] border-[#3E362E] text-[#F7F3EB] hover:bg-[#3A322B]'
                  : 'bg-red-950 border-red-500 text-red-200 hover:bg-red-900'
              }`}
            >
              ☁️ Nuvem: {!corteToxiproxyAtivo ? 'Saudável' : 'Corte de Lote Toxiproxy (CT13)'}
            </button>

            {/* 4. + Pedido iFood */}
            <button
              type="button"
              onClick={() => onInjetarPedido('IFOOD', false)}
              className="px-3 py-2 rounded-xl bg-[#EA1D2C]/20 hover:bg-[#EA1D2C]/35 border border-[#EA1D2C]/60 text-red-200 text-xs font-bold transition cursor-pointer"
            >
              + Pedido iFood
            </button>

            {/* 5. + Pedido Aiqfome */}
            <button
              type="button"
              onClick={() => onInjetarPedido('AIQFOME', false)}
              className="px-3 py-2 rounded-xl bg-[#7B1FA2]/25 hover:bg-[#7B1FA2]/40 border border-[#7B1FA2]/60 text-purple-200 text-xs font-bold transition cursor-pointer"
            >
              + Pedido Aiqfome
            </button>

            {/* 6. + Duplicata */}
            <button
              type="button"
              onClick={() => onInjetarPedido('IFOOD', true)}
              className="px-3 py-2 rounded-xl bg-[#2A2521] hover:bg-[#3A322B] border border-[#3E362E] text-[#E5DAC8] text-xs font-bold transition cursor-pointer"
            >
              + Duplicata (CT06)
            </button>

            {/* 7. Queda Elétrica */}
            <button
              type="button"
              onClick={onSimularQuedaEletrica}
              className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-200 text-xs font-bold transition cursor-pointer"
            >
              ⚡ Queda Elétrica (Reload WAL)
            </button>

            {/* 8. NOVO: Resetar Banco Demo */}
            <button
              type="button"
              onClick={onResetarBancoDemo}
              className="px-3 py-2 rounded-xl bg-red-600/25 hover:bg-red-600/40 border border-red-500/60 text-red-200 text-xs font-bold transition cursor-pointer ml-auto"
              title="Limpa o localStorage e recarrega todos os dados originais de fábrica do SeedData"
            >
              🗑️ Resetar Banco Demo
            </button>
          </div>
        </div>
      )}

      {/* Pílula Compacta no Rodapé */}
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        className="pointer-events-auto px-4 py-2 rounded-full bg-[#1E1B18]/95 hover:bg-[#2A2521] text-[#F7F3EB] border border-[#3E362E] shadow-xl flex items-center gap-3 text-xs font-bold transition cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          <span>🧪 Simulador de Caos &amp; Testes</span>
          <span className="text-[#E86F2C] font-mono">
            [{expandido ? 'Recolher ▼' : 'Expandir ▲'}]
          </span>
        </span>
        <span className="text-[#6E655F]">|</span>
        <span className="flex items-center gap-1.5 font-mono text-[11px]">
          <span>WAN:</span>
          <span className={wanOnline ? 'text-[#7AC13A]' : 'text-red-400'}>
            {wanOnline ? 'Online' : 'Offline'}
          </span>
        </span>
        <span className="text-[#6E655F]">|</span>
        <span className="flex items-center gap-1.5 font-mono text-[11px]">
          <span>Bobina:</span>
          <span className={possuiPapel ? 'text-[#7AC13A]' : 'text-amber-400'}>
            {possuiPapel ? 'OK' : 'Sem Papel'}
          </span>
        </span>
      </button>
    </div>
  );
}
