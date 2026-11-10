import React, { useMemo, useState } from 'react';
import {
  CATEGORIAS_PRODUTO,
  formatarBRL,
  reaisParaCentavos,
  type Carrinho,
  type CategoriaProduto,
  type MetodoPagamento,
  type Produto,
} from '../../domain';
import { AcademicBadge, IconCheck, IconEdit, IconPlus, IconSearch, IconTrash } from './Icons';

export interface PosViewProps {
  produtos: Produto[];
  carrinho: Carrinho;
  caixaAberto: boolean;
  modoAvaliador: boolean;
  categoriaFiltro: CategoriaProduto | 'TODAS';
  onChangeCategoria: (cat: CategoriaProduto | 'TODAS') => void;
  metodoSelecionado: MetodoPagamento;
  onChangeMetodo: (m: MetodoPagamento) => void;
  descontoInputReais: string;
  onChangeDescontoInput: (val: string) => void;
  onAplicarDesconto: () => void;
  onAdicionarCarrinho: (idProduto: number) => void;
  onAlterarQuantidadeCarrinho: (idProduto: number, novaQtd: number) => void;
  onLimparCarrinho: () => void;
  onFinalizarVenda: () => void;
  onAbrirModalNovoProduto: () => void;
  onAbrirModalEditarProduto: (p: Produto) => void;
  onExcluirProduto: (p: Produto) => void;
  onIrParaCaixa: () => void;
}

const META_CATEGORIAS: Record<
  CategoriaProduto | 'TODAS',
  { label: string; icone: string; faixaCor: string; badgeBg: string; badgeText: string }
> = {
  TODAS: {
    label: 'Todos',
    icone: '✨',
    faixaCor: 'from-[#E86F2C] to-[#D45D1B]',
    badgeBg: 'bg-[#FFF0E6]',
    badgeText: 'text-[#C85212]',
  },
  ENTRADAS: {
    label: 'Entradas',
    icone: '🥖',
    faixaCor: 'from-[#D97706] to-[#B45309]',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
  },
  MASSAS: {
    label: 'Massas',
    icone: '🍝',
    faixaCor: 'from-[#E86F2C] to-[#C85212]',
    badgeBg: 'bg-[#FFF0E6]',
    badgeText: 'text-[#C85212]',
  },
  PIZZAS: {
    label: 'Pizzas',
    icone: '🍕',
    faixaCor: 'from-[#DC2626] to-[#B91C1C]',
    badgeBg: 'bg-red-50',
    badgeText: 'text-red-800',
  },
  RISOTOS: {
    label: 'Risotos',
    icone: '🍲',
    faixaCor: 'from-[#4E8C22] to-[#3E7319]',
    badgeBg: 'bg-[#EEF7E6]',
    badgeText: 'text-[#3E7319]',
  },
  SOBREMESAS: {
    label: 'Sobremesas',
    icone: '🍰',
    faixaCor: 'from-[#9333EA] to-[#7E22CE]',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
  },
  BEBIDAS: {
    label: 'Bebidas',
    icone: '🍷',
    faixaCor: 'from-[#881337] to-[#4C0519]',
    badgeBg: 'bg-rose-50',
    badgeText: 'text-rose-900',
  },
};

const OPCOES_PAGAMENTO: { id: MetodoPagamento; label: string; icone: string }[] = [
  { id: 'PIX', label: 'PIX', icone: '💠' },
  { id: 'CREDITO', label: 'Crédito', icone: '💳' },
  { id: 'DEBITO', label: 'Débito', icone: '💳' },
  { id: 'DINHEIRO', label: 'Dinheiro', icone: '💵' },
];

export function PosView({
  produtos,
  carrinho,
  caixaAberto,
  modoAvaliador,
  categoriaFiltro,
  onChangeCategoria,
  metodoSelecionado,
  onChangeMetodo,
  descontoInputReais,
  onChangeDescontoInput,
  onAplicarDesconto,
  onAdicionarCarrinho,
  onAlterarQuantidadeCarrinho,
  onLimparCarrinho,
  onFinalizarVenda,
  onAbrirModalNovoProduto,
  onAbrirModalEditarProduto,
  onExcluirProduto,
  onIrParaCaixa,
}: PosViewProps): React.ReactElement {
  const [busca, setBusca] = useState('');
  const [descontoAberto, setDescontoAberto] = useState(false);
  const [valorRecebidoInput, setValorRecebidoInput] = useState('');

  // Mapa rápido de quantidades no carrinho por idProduto
  const mapaQtdComanda = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const item of carrinho.getItens()) {
      mapa.set(item.getIdProduto(), item.getQuantidade());
    }
    return mapa;
  }, [carrinho]);

  // Filtro instantâneo por busca + categoria
  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      const bateCat = categoriaFiltro === 'TODAS' || p.categoria === categoriaFiltro;
      if (!bateCat) return false;
      if (!termo) return true;
      return (
        p.nome.toLowerCase().includes(termo) ||
        p.descricao.toLowerCase().includes(termo) ||
        p.categoria.toLowerCase().includes(termo)
      );
    });
  }, [produtos, categoriaFiltro, busca]);

  const totalCentavos = carrinho.getTotalCentavos();
  const descontoAtivoCentavos = carrinho.getDescontoCentavos();

  // Cálculo de troco automático para pagamento em Dinheiro
  const calculoTroco = useMemo(() => {
    if (metodoSelecionado !== 'DINHEIRO' || !valorRecebidoInput.trim()) {
      return { recebidoCentavos: 0, trocoCentavos: 0, faltaCentavos: 0 };
    }
    try {
      const recebido = reaisParaCentavos(valorRecebidoInput);
      if (recebido >= totalCentavos) {
        return { recebidoCentavos: recebido, trocoCentavos: recebido - totalCentavos, faltaCentavos: 0 };
      }
      return { recebidoCentavos: recebido, trocoCentavos: 0, faltaCentavos: totalCentavos - recebido };
    } catch {
      return { recebidoCentavos: 0, trocoCentavos: 0, faltaCentavos: 0 };
    }
  }, [metodoSelecionado, valorRecebidoInput, totalCentavos]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:h-[calc(100vh-8.5rem)] min-h-[620px]">
      {/* ═══════════════════════════════════════════════════════════════════════
          ZONA 1: CATÁLOGO GASTRONÔMICO (ESQUERDA — ~65% / 8 COLUNAS)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-0">
        {/* Barra Superior: Busca Instantânea + Botão Novo Prato */}
        <div className="basilico-card rounded-2xl p-3.5 mb-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-[#6E655F] pointer-events-none">
              <IconSearch size={17} />
            </span>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar prato, ingrediente ou bebida..."
              className="w-full pl-10 pr-8 py-2 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-sm text-[#23201E] placeholder-[#968B82] focus:outline-none focus:border-[#E86F2C] focus:ring-2 focus:ring-[#E86F2C]/20 transition"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-[#6E655F] hover:text-[#23201E] cursor-pointer"
                title="Limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <AcademicBadge codigo="RF01 · Centavos Inteiros · CT01" visivel={modoAvaliador} />
            <button
              type="button"
              onClick={onAbrirModalNovoProduto}
              className="px-4 py-2 rounded-xl bg-[#1E1B18] hover:bg-[#2F2A25] text-[#F7F3EB] text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <IconPlus size={15} className="text-[#E86F2C]" />
              <span>Novo Prato</span>
            </button>
          </div>
        </div>

        {/* Barra de Categorias com Ícones (Pílulas Grandes para Toque Rápido) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 shrink-0">
          {(['TODAS', ...CATEGORIAS_PRODUTO] as const).map((cat) => {
            const meta = META_CATEGORIAS[cat];
            const ativa = categoriaFiltro === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onChangeCategoria(cat)}
                className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-2 whitespace-nowrap transition shrink-0 cursor-pointer ${
                  ativa
                    ? 'bg-[#E86F2C] text-white shadow-md shadow-[#E86F2C]/25 border border-[#E86F2C]'
                    : 'bg-white hover:bg-[#F2E9D8] text-[#23201E] border border-[#E6DEC8]'
                }`}
              >
                <span className="text-sm leading-none">{meta.icone}</span>
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {/* Grade Rolável de Cards de Produtos (3 colunas em telas grandes) */}
        <div className="flex-1 overflow-y-auto pr-1 pb-4">
          {produtosFiltrados.length === 0 ? (
            <div className="basilico-card rounded-2xl p-12 text-center">
              <div className="text-3xl mb-2">🍽️</div>
              <h3 className="text-base font-bold text-[#23201E]">Nenhum prato encontrado</h3>
              <p className="text-xs text-[#6E655F] mt-1">
                Tente buscar por outro termo ou selecione a categoria &ldquo;Todos&rdquo;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {produtosFiltrados.map((p) => {
                const meta = META_CATEGORIAS[p.categoria];
                const qtdNaComanda = mapaQtdComanda.get(p.id) ?? 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => onAdicionarCarrinho(p.id)}
                    className={`basilico-card-interactive rounded-2xl overflow-hidden flex flex-col justify-between relative cursor-pointer group ${
                      qtdNaComanda > 0 ? 'ring-2 ring-[#E86F2C] border-[#E86F2C]' : ''
                    }`}
                  >
                    {/* Faixa Superior Colorida da Categoria */}
                    <div className={`h-1.5 w-full bg-gradient-to-r ${meta.faixaCor}`} />

                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        {/* Topo do Card: Tag da Categoria + Badge na Comanda + Ações CRUD */}
                        <div className="flex items-center justify-between gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${meta.badgeBg} ${meta.badgeText}`}
                          >
                            <span>{meta.icone}</span>
                            <span>{meta.label}</span>
                          </span>

                          <div className="flex items-center gap-1">
                            {qtdNaComanda > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-[#E86F2C] text-white font-mono font-bold text-[10px] shadow-xs">
                                {qtdNaComanda}x na comanda
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onAbrirModalEditarProduto(p);
                              }}
                              title="Editar prato"
                              className="p-1.5 rounded-lg text-[#6E655F] hover:text-[#23201E] hover:bg-[#F2E9D8] transition cursor-pointer"
                            >
                              <IconEdit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onExcluirProduto(p);
                              }}
                              title="Excluir prato do catálogo"
                              className="p-1.5 rounded-lg text-[#6E655F] hover:text-[#DC2626] hover:bg-red-50 transition cursor-pointer"
                            >
                              <IconTrash size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Nome do Prato e Descrição em 2 linhas */}
                        <h3 className="text-sm font-extrabold text-[#23201E] mt-2.5 group-hover:text-[#E86F2C] transition leading-snug">
                          {p.nome}
                        </h3>
                        <p className="text-xs text-[#6E655F] mt-1 line-clamp-2 leading-relaxed">
                          {p.descricao}
                        </p>
                      </div>

                      {/* Rodapé do Card: Preço em Destaque + Botão Adicionar */}
                      <div className="mt-3.5 pt-3 border-t border-[#F2E9D8] flex items-center justify-between gap-2">
                        <span className="font-mono font-extrabold text-base text-[#23201E]">
                          {formatarBRL(p.precoCentavos)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAdicionarCarrinho(p.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition cursor-pointer ${
                            qtdNaComanda > 0
                              ? 'bg-[#E86F2C] text-white shadow-xs'
                              : 'bg-[#FFF0E6] group-hover:bg-[#E86F2C] text-[#E86F2C] group-hover:text-white'
                          }`}
                        >
                          <IconPlus size={13} />
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          ZONA 2: COMANDA DE BALCÃO & CHECKOUT FIXO (DIREITA — ~35% / 4 COLUNAS)
      ═══════════════════════════════════════════════════════════════════════ */}
      <div className="lg:col-span-5 xl:col-span-4 basilico-card rounded-2xl flex flex-col h-full min-h-[520px] overflow-hidden">
        {/* Cabeçalho da Comanda */}
        <div className="px-4 py-3.5 bg-[#1E1B18] text-[#F7F3EB] flex items-center justify-between gap-2 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold tracking-tight">Comanda de Balcão</h2>
              <AcademicBadge codigo="WAL · RPO=0 · CT12" visivel={modoAvaliador} variante="dark" />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#B8AEA2] mt-0.5">
              <span className="text-[#7AC13A]">⚡</span>
              <span>
                {modoAvaliador
                  ? 'Salvo no disco (WAL SQLite Cifrado)'
                  : 'Salvo automaticamente contra queda de energia'}
              </span>
            </div>
          </div>

          {!carrinho.estaVazio() && (
            <button
              type="button"
              onClick={() => {
                onLimparCarrinho();
                setValorRecebidoInput('');
              }}
              className="px-2.5 py-1 rounded-lg bg-[#2A2521] hover:bg-red-950/80 text-xs font-semibold text-[#F7F3EB] hover:text-red-200 border border-[#3E362E] transition cursor-pointer"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Lista de Itens Rolável */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2 bg-[#FAF6EE]/60 min-h-[160px]">
          {carrinho.estaVazio() ? (
            <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-[#E6DEC8] rounded-2xl">
              <div className="w-11 h-11 rounded-full bg-[#F2E9D8] text-[#6E655F] flex items-center justify-center text-lg mb-2">
                🍝
              </div>
              <p className="text-xs font-bold text-[#23201E]">Comanda vazia</p>
              <p className="text-[11px] text-[#6E655F] mt-0.5 max-w-[220px]">
                Toque em qualquer prato ou bebida do catálogo ao lado para lançar na comanda.
              </p>
            </div>
          ) : (
            carrinho.getItens().map((item) => (
              <div
                key={item.getIdProduto()}
                className="bg-white border border-[#E6DEC8] rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#23201E] truncate">
                    {item.getNomeProduto()}
                  </div>
                  <div className="text-[11px] text-[#6E655F] font-mono">
                    {formatarBRL(item.getPrecoUnitarioCentavos())} un.
                  </div>
                </div>

                {/* Controles de Toque - 1 + */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      onAlterarQuantidadeCarrinho(item.getIdProduto(), item.getQuantidade() - 1)
                    }
                    className="w-7 h-7 rounded-lg bg-[#F2E9D8] hover:bg-[#E86F2C] text-[#23201E] hover:text-white font-bold text-sm flex items-center justify-center transition cursor-pointer"
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-mono font-extrabold text-xs text-[#23201E]">
                    {item.getQuantidade()}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onAlterarQuantidadeCarrinho(item.getIdProduto(), item.getQuantidade() + 1)
                    }
                    className="w-7 h-7 rounded-lg bg-[#F2E9D8] hover:bg-[#E86F2C] text-[#23201E] hover:text-white font-bold text-sm flex items-center justify-center transition cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <div className="w-20 text-right font-mono font-extrabold text-xs text-[#23201E] shrink-0">
                  {formatarBRL(item.getSubtotalCentavos())}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé de Pagamento Fixo na Base da Comanda */}
        <div className="p-4 bg-white border-t border-[#E6DEC8] space-y-3 shrink-0">
          {/* Linha Compacta/Expansível de Desconto */}
          <div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDescontoAberto((v) => !v)}
                className="text-xs font-bold text-[#6E655F] hover:text-[#E86F2C] flex items-center gap-1 transition cursor-pointer"
              >
                <span>🏷️ {descontoAtivoCentavos > 0 ? 'Alterar Desconto' : 'Adicionar Desconto (R$)'}</span>
                <span className="text-[10px]">{descontoAberto ? '▲' : '▼'}</span>
              </button>
              {descontoAtivoCentavos > 0 && (
                <span className="text-xs font-mono font-bold text-[#D97706]">
                  −{formatarBRL(descontoAtivoCentavos)}
                </span>
              )}
            </div>

            {descontoAberto && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={descontoInputReais}
                  onChange={(e) => onChangeDescontoInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] text-xs font-mono text-[#23201E] focus:outline-none focus:border-[#E86F2C]"
                  placeholder="0,00"
                />
                <button
                  type="button"
                  onClick={onAplicarDesconto}
                  className="px-3.5 py-1.5 rounded-xl bg-[#F2E9D8] hover:bg-[#E86F2C] text-[#23201E] hover:text-white text-xs font-bold transition cursor-pointer"
                >
                  Aplicar
                </button>
              </div>
            )}
          </div>

          {/* Seleção de Forma de Pagamento em 4 Botões Visuais */}
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-[#6E655F] mb-1.5">
              Forma de Pagamento
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {OPCOES_PAGAMENTO.map((op) => {
                const selecionado = metodoSelecionado === op.id;
                return (
                  <button
                    key={op.id}
                    type="button"
                    onClick={() => onChangeMetodo(op.id)}
                    className={`py-2 px-1.5 rounded-xl text-xs font-bold border flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                      selecionado
                        ? 'bg-[#FFF0E6] text-[#E86F2C] border-[#E86F2C] ring-1 ring-[#E86F2C]'
                        : 'bg-[#FAF6EE] text-[#23201E] border-[#E6DEC8] hover:bg-[#F2E9D8]'
                    }`}
                  >
                    <span className="text-sm leading-none">{op.icone}</span>
                    <span className="text-[11px]">{op.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Campo Rápido de Valor Recebido e Cálculo de Troco (Quando Dinheiro Selecionado) */}
          {metodoSelecionado === 'DINHEIRO' && totalCentavos > 0 && (
            <div className="p-2.5 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-[#23201E]">
                  💵 Valor Recebido (R$):
                </label>
                <input
                  type="text"
                  value={valorRecebidoInput}
                  onChange={(e) => setValorRecebidoInput(e.target.value)}
                  placeholder={(totalCentavos / 100).toFixed(2).replace('.', ',')}
                  className="w-28 px-2.5 py-1 rounded-lg bg-white border border-[#D5C8AE] text-right font-mono text-xs font-bold text-[#23201E] focus:outline-none focus:border-[#E86F2C]"
                />
              </div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex gap-1">
                  {[
                    { rotulo: 'Exato', val: (totalCentavos / 100).toFixed(2).replace('.', ',') },
                    { rotulo: 'R$ 50', val: '50,00' },
                    { rotulo: 'R$ 100', val: '100,00' },
                    { rotulo: 'R$ 200', val: '200,00' },
                  ].map((atalho) => (
                    <button
                      key={atalho.rotulo}
                      type="button"
                      onClick={() => setValorRecebidoInput(atalho.val)}
                      className="px-2 py-0.5 rounded bg-[#F2E9D8] hover:bg-[#E86F2C] hover:text-white text-[10px] font-mono font-bold text-[#23201E] transition cursor-pointer"
                    >
                      {atalho.rotulo}
                    </button>
                  ))}
                </div>
                {valorRecebidoInput.trim() && (
                  <div className="text-xs font-mono font-extrabold">
                    {calculoTroco.faltaCentavos > 0 ? (
                      <span className="text-[#DC2626]">
                        Faltam {formatarBRL(calculoTroco.faltaCentavos)}
                      </span>
                    ) : (
                      <span className="text-[#4E8C22]">
                        Troco: {formatarBRL(calculoTroco.trocoCentavos)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Resumo Financeiro da Comanda */}
          <div className="p-3 rounded-xl bg-[#FAF6EE] border border-[#E6DEC8] space-y-1">
            <div className="flex justify-between text-xs text-[#6E655F]">
              <span>Subtotal ({carrinho.getQuantidadeItens()} itens)</span>
              <span className="font-mono font-semibold">{formatarBRL(carrinho.getSubtotalCentavos())}</span>
            </div>
            {descontoAtivoCentavos > 0 && (
              <div className="flex justify-between text-xs text-[#D97706] font-medium">
                <span>Desconto concedido</span>
                <span className="font-mono">−{formatarBRL(descontoAtivoCentavos)}</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-1.5 border-t border-[#E6DEC8]">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#23201E]">
                Total a Pagar
              </span>
              <span className="font-mono text-xl font-extrabold text-[#4E8C22]">
                {formatarBRL(totalCentavos)}
              </span>
            </div>
          </div>

          {/* Botão Primário Gigante em Verde Manjericão (#4E8C22) */}
          {caixaAberto ? (
            <button
              type="button"
              disabled={carrinho.estaVazio()}
              onClick={() => {
                onFinalizarVenda();
                setValorRecebidoInput('');
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-[#4E8C22] hover:bg-[#3E7319] active:scale-[0.99] disabled:bg-[#E6DEC8] disabled:text-[#968B82] text-white font-extrabold text-sm shadow-md shadow-[#4E8C22]/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <IconCheck size={18} />
              <span>
                Finalizar Venda e Emitir Cupom ({formatarBRL(totalCentavos)})
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onIrParaCaixa}
              className="w-full py-3 px-4 rounded-xl bg-[#D97706] hover:bg-amber-700 text-white font-extrabold text-xs shadow-sm transition cursor-pointer"
            >
              ⚠️ Caixa Fechado — Clique para Abrir o Turno
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
