import React, { useState } from 'react';
import type { TrabalhoImpresso } from '../../infrastructure';
import { AcademicBadge, IconClose, IconPin, IconPrinter } from './Icons';

export interface ThermalPrinterDrawerProps {
  aberto: boolean;
  fixado: boolean;
  possuiPapel: boolean;
  descricaoImpressora: string;
  ultimaImpressao: TrabalhoImpresso | null;
  historicoImpressoes: readonly TrabalhoImpresso[];
  modoAvaliador: boolean;
  onFechar: () => void;
  onToggleFixado: () => void;
  onToggleBobina: () => void;
}

export function ThermalPrinterDrawer({
  aberto,
  fixado,
  possuiPapel,
  descricaoImpressora,
  ultimaImpressao,
  historicoImpressoes,
  modoAvaliador,
  onFechar,
  onToggleFixado,
  onToggleBobina,
}: ThermalPrinterDrawerProps): React.ReactElement | null {
  const [mostrarHexDump, setMostrarHexDump] = useState(false);
  const [idJobSelecionado, setIdJobSelecionado] = useState<number | null>(null);

  if (!aberto && !fixado) return null;

  const trabalhoAtivo =
    (idJobSelecionado !== null
      ? historicoImpressoes.find((j) => j.idJob === idJobSelecionado)
      : null) ?? ultimaImpressao;

  return (
    <div
      className="fixed top-16 right-4 bottom-14 z-40 w-[370px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl bg-[#1E1B18] text-[#F7F3EB] border border-[#3E362E] shadow-xl shadow-stone-900/10 overflow-hidden transition-all"
    >
      {/* Cabeçalho da Impressora Térmica */}
      <div className="px-4 py-3 bg-[#26221E] border-b border-[#3A322B] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              possuiPapel
                ? 'bg-[#4E8C22]/20 text-[#7AC13A] border border-[#5CA329]/40'
                : 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
            }`}
          >
            <IconPrinter size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-extrabold tracking-tight truncate">
                Bobina Térmica 80mm
              </h3>
              <AcademicBadge codigo="RF04 · RN03" visivel={modoAvaliador} variante="dark" />
            </div>
            <p className="text-[10px] text-[#B8AEA2] truncate">{descricaoImpressora}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleFixado}
            title={fixado ? 'Desafixar painel' : 'Fixar bobina na tela (Pin)'}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border transition cursor-pointer ${
              fixado
                ? 'bg-[#E86F2C] text-white border-[#E86F2C]'
                : 'bg-[#1E1B18] text-[#B8AEA2] border-[#3A322B] hover:text-white'
            }`}
          >
            <IconPin size={12} />
            <span>{fixado ? 'Fixado' : 'Fixar'}</span>
          </button>

          {!fixado && (
            <button
              type="button"
              onClick={onFechar}
              title="Fechar visualização da bobina"
              className="p-1.5 rounded-lg text-[#B8AEA2] hover:text-white hover:bg-[#3A322B] transition cursor-pointer"
            >
              <IconClose size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Status Físico da Bobina + Seletor de Histórico */}
      <div className="px-4 py-2 bg-[#1E1B18] border-b border-[#332D27] flex items-center justify-between gap-2 text-[11px] shrink-0">
        <button
          type="button"
          onClick={onToggleBobina}
          className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 border transition cursor-pointer ${
            possuiPapel
              ? 'bg-[#4E8C22]/15 text-[#7AC13A] border-[#5CA329]/40 hover:bg-[#4E8C22]/25'
              : 'bg-red-950 text-red-200 border-red-500 animate-pulse'
          }`}
          title="Clique para simular troca ou fim da bobina de papel 80mm"
        >
          <span className={`w-2 h-2 rounded-full ${possuiPapel ? 'bg-[#7AC13A]' : 'bg-red-500'}`} />
          <span>{possuiPapel ? 'Bobina 80mm OK' : 'SEM PAPEL (Erro 0x72)'}</span>
        </button>

        {historicoImpressoes.length > 1 && (
          <select
            value={trabalhoAtivo?.idJob ?? ''}
            onChange={(e) => setIdJobSelecionado(Number(e.target.value))}
            className="px-2 py-1 rounded-lg bg-[#2A2521] border border-[#3E362E] text-[10px] font-mono text-[#F7F3EB]"
          >
            {historicoImpressoes.map((j) => (
              <option key={j.idJob} value={j.idJob}>
                Job #{j.idJob} · {j.tipo === 'CUPOM_VENDA' ? 'Cupom PDV' : 'Via Cozinha'}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Corpo Rolável 100% Dedicado ao Papel Térmico Estilizado */}
      <div className="flex-1 overflow-y-auto p-4 bg-[#171412]">
        {trabalhoAtivo ? (
          <div>
            {/* Borda Serrilhada Superior (Papel Rasgado) */}
            <div className="thermal-serrated-top" />

            {/* Corpo da Bobina */}
            <div className="thermal-paper px-4 py-3 text-xs leading-relaxed overflow-x-auto">
              <div className="flex justify-between items-center text-[10px] text-stone-600 border-b border-dashed border-stone-400/70 pb-1.5 mb-2 font-mono">
                <span className="font-bold">
                  JOB #{trabalhoAtivo.idJob} · {trabalhoAtivo.tipo}
                </span>
                <span>
                  {trabalhoAtivo.tempoMs}ms · {trabalhoAtivo.bytesEscPos.byteLength}B
                </span>
              </div>
              <pre className="text-[11px] leading-[1.38] whitespace-pre font-mono text-[#1C1917]">
                {trabalhoAtivo.linhasRenderizadas.join('\n')}
              </pre>
            </div>

            {/* Borda Serrilhada Inferior */}
            <div className="thermal-serrated-bottom" />
          </div>
        ) : (
          <div className="my-8 p-6 rounded-2xl border border-dashed border-[#3A322B] text-center space-y-2">
            <div className="text-2xl">🧾</div>
            <div className="text-xs font-bold text-[#F7F3EB]">Aguardando emissão térmica</div>
            <p className="text-[11px] text-[#B8AEA2] leading-relaxed">
              Finalize uma venda no balcão ou aceite um pedido no Hub de Delivery para visualizar a bobina de 80mm aqui automaticamente.
            </p>
          </div>
        )}
      </div>

      {/* Rodapé Minimalista e Discreto: Modo Técnico sob demanda */}
      {trabalhoAtivo && (
        <div className="border-t border-[#2E2722] bg-[#1A1714] px-4 py-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setMostrarHexDump((v) => !v)}
            className="w-full py-1 text-center text-[11px] font-medium text-[#968B82] hover:text-[#E5DAC8] transition cursor-pointer"
          >
            [ 🖨️ Modo Técnico: Inspecionar Bytes ESC/POS {mostrarHexDump ? '▲' : '▼'} ]
          </button>

          {mostrarHexDump && (
            <div className="mt-2 p-2.5 rounded-xl bg-[#12100E] border border-[#2E2722] space-y-1.5 transition-all">
              <div className="flex items-center justify-between text-[10px] text-[#968B82] font-mono">
                <span>Init (1B 40) · CP850 · Cut (1D 56)</span>
                <span>{trabalhoAtivo.bytesEscPos.byteLength} bytes</span>
              </div>
              <div className="font-mono text-[10px] text-[#7AC13A] break-all leading-relaxed max-h-28 overflow-y-auto">
                {trabalhoAtivo.hexDump}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
