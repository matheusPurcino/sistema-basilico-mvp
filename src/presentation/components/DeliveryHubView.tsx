import React, { useState } from 'react';
import { formatarBRL, type PedidoDelivery, type Plataforma, type StatusPedido } from '../../domain';
import { AcademicBadge, IconCheck, IconPrinter } from './Icons';

export interface DeliveryHubViewProps {
  pedidos: PedidoDelivery[];
  filaReimpressao: PedidoDelivery[];
  possuiPapel: boolean;
  versaoTls: string;
  renovacoesOAuth: number;
  modoAvaliador: boolean;
  onAceitarPedido: (idInterno: string) => void;
  onReimprimirPedido: (idInterno: string) => void;
  onAbrirModalRecusa: (idInterno: string) => void;
  onConcluirPedido: (idInterno: string) => void;
  onInjetarPedido: (plataforma: Plataforma, duplicado?: boolean) => void;
  onToggleBobina: () => void;
}

type FiltroKds = 'TODOS' | 'NOVOS' | 'RETIDOS' | 'EM_PREPARO' | 'FINALIZADOS';

export function DeliveryHubView({
  pedidos,
  filaReimpressao,
  possuiPapel,
  versaoTls,
  renovacoesOAuth,
  modoAvaliador,
  onAceitarPedido,
  onReimprimirPedido,
  onAbrirModalRecusa,
  onConcluirPedido,
  onInjetarPedido,
  onToggleBobina,
}: DeliveryHubViewProps): React.ReactElement {
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroKds>('TODOS');

  const qtdNovos = pedidos.filter((p) => p.getStatus() === 'RECEBIDO').length;
  const qtdRetidos = pedidos.filter((p) => p.getStatus() === 'PENDENTE_IMPRESSAO').length;
  const qtdPreparo = pedidos.filter((p) => p.getStatus() === 'EM_PREPARO').length;
  const qtdFinalizados = pedidos.filter(
    (p) => p.getStatus() === 'CONCLUIDO' || p.getStatus() === 'RECUSADO',
  ).length;

  const pedidosVisiveis = pedidos.filter((p) => {
    const st = p.getStatus();
    if (filtroAtivo === 'NOVOS') return st === 'RECEBIDO';
    if (filtroAtivo === 'RETIDOS') return st === 'PENDENTE_IMPRESSAO';
    if (filtroAtivo === 'EM_PREPARO') return st === 'EM_PREPARO';
    if (filtroAtivo === 'FINALIZADOS') return st === 'CONCLUIDO' || st === 'RECUSADO';
    return true;
  });

  const renderBadgePlataforma = (plataforma: Plataforma, codigoExterno: string) => {
    const isIfood = plataforma === 'IFOOD';
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-extrabold text-xs tracking-tight text-white shadow-xs ${
          isIfood ? 'bg-[#EA1D2C]' : 'bg-[#7B1FA2]'
        }`}
      >
        <span>{isIfood ? '🔴 iFood' : '🟣 Aiqfome'}</span>
        <span className="font-mono opacity-95">#{codigoExterno}</span>
      </span>
    );
  };

  const renderBadgeStatus = (status: StatusPedido) => {
    switch (status) {
      case 'RECEBIDO':
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#FFF0E6] text-[#E86F2C] border border-[#E86F2C]/40 font-extrabold text-[11px] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#E86F2C]" />
            <span>Aguardando Aceite</span>
          </span>
        );
      case 'PENDENTE_IMPRESSAO':
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-400 font-extrabold text-[11px] flex items-center gap-1.5 animate-pulse">
            <span>⚠️ Retido na Impressora</span>
          </span>
        );
      case 'EM_PREPARO':
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#EEF7E6] text-[#4E8C22] border border-[#4E8C22]/30 font-extrabold text-[11px] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#4E8C22]" />
            <span>Em Preparo na Cozinha</span>
          </span>
        );
      case 'CONCLUIDO':
        return (
          <span className="px-2.5 py-1 rounded-full bg-[#F2E9D8] text-[#6E655F] font-bold text-[11px]">
            ✓ Entregue / Concluído
          </span>
        );
      case 'RECUSADO':
        return (
          <span className="px-2.5 py-1 rounded-full bg-red-50 text-[#DC2626] border border-red-200 font-bold text-[11px]">
            ✕ Recusado
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho do Hub KDS */}
      <div className="basilico-card rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-bold text-[#23201E]">
              Hub Central de Delivery
            </h2>
            <AcademicBadge codigo="RF03 · RF04 · RN03 · CT06 · CT09 · CT14" visivel={modoAvaliador} />
          </div>
          <p className="text-xs text-[#6E655F] mt-1">
            {modoAvaliador
              ? 'Recepção unificada iFood/Aiqfome com deduplicação idempotente e confirmação física obrigatória na impressora térmica 80mm.'
              : 'Gerencie os pedidos do iFood e Aiqfome em uma única tela. Ao aceitar, a via de preparo é impressa automaticamente na cozinha.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {modoAvaliador && (
            <div className="flex items-center gap-2 mr-1">
              <span className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] border border-[#E6DEC8] text-[11px] font-mono text-[#23201E]">
                Canal: <strong className="text-[#4E8C22]">{versaoTls}</strong>
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] border border-[#E6DEC8] text-[11px] font-mono text-[#23201E]">
                OAuth2: <strong>{renovacoesOAuth} renov.</strong>
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => onInjetarPedido('IFOOD', false)}
            className="px-3.5 py-2 rounded-xl bg-[#EA1D2C] hover:bg-[#C81422] text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            + Simular Pedido iFood
          </button>
          <button
            type="button"
            onClick={() => onInjetarPedido('AIQFOME', false)}
            className="px-3.5 py-2 rounded-xl bg-[#7B1FA2] hover:bg-[#631884] text-white font-bold text-xs shadow-xs transition cursor-pointer"
          >
            + Simular Pedido Aiqfome
          </button>
        </div>
      </div>

      {/* Alerta Global de Fila de Reimpressão (RN03) */}
      {filaReimpressao.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border-2 border-[#D97706] text-amber-950 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">🖨️</span>
            <div>
              <div className="font-extrabold text-sm flex items-center gap-2">
                <span>
                  Atenção: {filaReimpressao.length} pedido(s) retido(s) aguardando papel na impressora da cozinha!
                </span>
                <AcademicBadge codigo="RN03 / CT14" visivel={modoAvaliador} variante="amber" />
              </div>
              <p className="text-xs text-amber-900 mt-0.5">
                O pedido foi aceito na plataforma parceira, mas não entrou em preparo porque a impressora está sem bobina.
              </p>
            </div>
          </div>

          {!possuiPapel && (
            <button
              type="button"
              onClick={onToggleBobina}
              className="px-4 py-2 rounded-xl bg-[#1E1B18] hover:bg-[#2F2A25] text-[#F7F3EB] font-bold text-xs shadow-sm transition cursor-pointer"
            >
              🔄 Trocar Bobina de Papel 80mm Agora
            </button>
          )}
        </div>
      )}

      {/* Filtros Rápidos do KDS (Colunas / Status) */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'TODOS', label: 'Todos os Pedidos', qtd: pedidos.length },
            { id: 'NOVOS', label: 'Novos / Aguardando Aceite', qtd: qtdNovos },
            { id: 'RETIDOS', label: 'Retidos na Impressora', qtd: qtdRetidos },
            { id: 'EM_PREPARO', label: 'Em Preparo na Cozinha', qtd: qtdPreparo },
            { id: 'FINALIZADOS', label: 'Concluídos / Recusados', qtd: qtdFinalizados },
          ] as const
        ).map((aba) => {
          const ativo = filtroAtivo === aba.id;
          return (
            <button
              key={aba.id}
              type="button"
              onClick={() => setFiltroAtivo(aba.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition cursor-pointer ${
                ativo
                  ? 'bg-[#1E1B18] text-[#F7F3EB] border-[#1E1B18] shadow-sm'
                  : 'bg-white hover:bg-[#F2E9D8] text-[#23201E] border-[#E6DEC8]'
              }`}
            >
              <span>{aba.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
                  ativo ? 'bg-[#E86F2C] text-white' : 'bg-[#F2E9D8] text-[#23201E]'
                }`}
              >
                {aba.qtd}
              </span>
            </button>
          );
        })}
      </div>

      {/* Grid de Cards de Pedidos KDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {pedidosVisiveis.map((ped) => {
          const status = ped.getStatus();
          const isNovo = status === 'RECEBIDO';
          const isRetido = status === 'PENDENTE_IMPRESSAO';
          const isPreparo = status === 'EM_PREPARO';

          return (
            <div
              key={ped.getIdInterno()}
              className={`basilico-card shadow-xl shadow-stone-900/5 rounded-2xl p-5 flex flex-col justify-between transition ${
                isNovo
                  ? 'ring-2 ring-[#E86F2C] border-[#E86F2C]'
                  : isRetido
                    ? 'ring-2 ring-[#D97706] border-[#D97706] bg-amber-50/40'
                    : isPreparo
                      ? 'border-l-4 border-l-[#4E8C22]'
                      : 'opacity-85'
              }`}
            >
              <div>
                {/* Topo do Card: Plataforma + Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#F2E9D8]">
                  {renderBadgePlataforma(ped.getPlataforma(), ped.getCodigoExterno())}
                  {renderBadgeStatus(status)}
                </div>

                {/* Dados do Cliente */}
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-[#23201E]">
                      {ped.getClienteNome()}
                    </span>
                    {ped.isAnonimizadoLgpd() && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 border border-purple-300 text-[10px] font-mono font-bold text-purple-900">
                        🔒 LGPD Anonimizado
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#6E655F] font-mono">{ped.getClienteTelefone()}</div>
                  <div className="text-xs text-[#6E655F] line-clamp-1" title={ped.getClienteEndereco()}>
                    📍 {ped.getClienteEndereco()}
                  </div>
                </div>

                {/* Alerta Explicativo Âmbar quando Retido na Impressora (RN03) */}
                {isRetido && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-100/90 border border-amber-400 text-amber-950 text-xs leading-relaxed">
                    <strong>Atenção:</strong> Pedido aceito na plataforma, mas a impressora da cozinha está{' '}
                    <strong>SEM BOBINA</strong>. Troque o papel e clique em Reimprimir.
                  </div>
                )}

                {/* Lista de Itens do Pedido */}
                <div className="mt-3.5 p-3 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#6E655F] mb-1">
                    Itens da Cozinha ({ped.getItens().length})
                  </div>
                  {ped.getItens().map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#23201E]">
                        <span className="inline-block w-5 font-mono text-[#E86F2C]">
                          {item.getQuantidade()}x
                        </span>{' '}
                        {item.getNomeProduto()}
                      </span>
                      <span className="font-mono text-[#6E655F]">
                        {formatarBRL(item.getSubtotalCentavos())}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rodapé do Card: Total + Botões de Ação */}
              <div className="mt-4 pt-3 border-t border-[#E6DEC8] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#6E655F]">
                    Total do Pedido
                  </span>
                  <span className="font-mono font-extrabold text-lg text-[#23201E]">
                    {formatarBRL(ped.getValorTotalCentavos())}
                  </span>
                </div>

                {isNovo && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAceitarPedido(ped.getIdInterno())}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-[#4E8C22] hover:bg-[#3E7319] text-white font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <IconCheck size={15} />
                      <span>Aceitar e Imprimir na Cozinha</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onAbrirModalRecusa(ped.getIdInterno())}
                      className="py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-[#DC2626] font-bold text-xs transition cursor-pointer"
                    >
                      Recusar
                    </button>
                  </div>
                )}

                {isRetido && (
                  <button
                    type="button"
                    onClick={() => onReimprimirPedido(ped.getIdInterno())}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#D97706] hover:bg-amber-700 text-white font-extrabold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <IconPrinter size={15} />
                    <span>🖨️ Reimprimir Via da Cozinha</span>
                  </button>
                )}

                {isPreparo && (
                  <button
                    type="button"
                    onClick={() => onConcluirPedido(ped.getIdInterno())}
                    className="w-full py-2.5 px-3 rounded-xl bg-[#1E1B18] hover:bg-[#2F2A25] text-[#F7F3EB] font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <IconCheck size={15} className="text-[#7AC13A]" />
                    <span>Despachar / Concluir Entrega</span>
                  </button>
                )}

                {status === 'RECUSADO' && ped.getMotivoRecusa() && (
                  <div className="text-[11px] text-[#DC2626] bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                    Motivo da recusa: <strong>{ped.getMotivoRecusa()}</strong>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
