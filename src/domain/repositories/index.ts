/**
 * Contratos de Repositório (portas de persistência) — camada de domínio.
 * Implementados em `src/infrastructure/persistence` sobre o SQLiteEngine.
 */
import type { CarrinhoSnapshot } from '../entities/Carrinho';
import type { EstadoPersistidoCaixa } from '../entities/Caixa';
import type { PedidoDelivery, Plataforma } from '../entities/PedidoDelivery';
import type { NovoProduto, Produto } from '../entities/Produto';
import type { Usuario } from '../entities/Usuario';
import type { EventoCompensatorio, RelatorioFechamento } from '../entities/ValueObjects';
import type { Venda } from '../entities/Venda';

export type TipoEventoOutbox = 'VENDA_REGISTRADA' | 'ESTORNO_REGISTRADO' | 'CAIXA_FECHADO';
export type StatusOutbox = 'PENDENTE' | 'SINCRONIZADO' | 'DEAD_LETTER';

export interface EventoOutbox {
  seq: number;
  idEvento: string;
  tipo: TipoEventoOutbox;
  agregadoId: string;
  payload: string;
  status: StatusOutbox;
  tentativas: number;
  ultimoErro: string | null;
  criadoEm: string;
  sincronizadoEm: string | null;
}

export interface NovoEventoOutbox {
  idEvento: string;
  tipo: TipoEventoOutbox;
  agregadoId: string;
  payload: unknown;
  criadoEm: string;
}

export interface IOutboxRepository {
  registrar(evento: NovoEventoOutbox): number;
  proximoLote(limite: number): EventoOutbox[];
  marcarSincronizados(ids: string[], em: string): void;
  registrarFalha(ids: string[], erro: string, maxTentativas: number): EventoOutbox[];
  contarPendentes(): number;
  listar(limite?: number): EventoOutbox[];
  listarDeadLetter(): EventoOutbox[];
}

export interface IProdutoRepository {
  listar(incluirInativos?: boolean): Produto[];
  buscar(id: number): Produto | undefined;
  criar(p: NovoProduto): Produto;
  atualizar(p: Produto): void;
  remover(id: number): void;
  contar(): number;
}

export interface IVendaRepository {
  salvar(venda: Venda): void;
  marcarEstornada(idVenda: string): void;
  marcarSincronizadas(idsVenda: string[]): void;
  proximoNumeroSequencial(): number;
  listar(): Venda[];
  buscar(idVenda: string): Venda | undefined;
  salvarEventoCompensatorio(e: EventoCompensatorio): void;
  listarEventosCompensatorios(): EventoCompensatorio[];
  contar(): number;
}

export interface IPedidoRepository {
  inserir(p: PedidoDelivery): void;
  atualizar(p: PedidoDelivery): void;
  existeCodigoExterno(plataforma: Plataforma, codigo: string): boolean;
  buscar(idInterno: string): PedidoDelivery | undefined;
  listar(): PedidoDelivery[];
}

export interface RegistroAuditoria {
  id: number;
  dataHora: string;
  usuario: string;
  acao: string;
  categoria: 'SEGURANCA' | 'VENDA' | 'ESTORNO' | 'CAIXA' | 'DELIVERY' | 'INTEGRACAO' | 'SYNC' | 'LGPD' | 'IMPRESSAO';
  entidadeId: string | null;
  detalhes: string;
}

export interface IAuditLogRepository {
  registrar(r: Omit<RegistroAuditoria, 'id'>): void;
  listar(limite?: number): RegistroAuditoria[];
}

export interface ICarrinhoRepository {
  salvar(c: CarrinhoSnapshot, em: string): void;
  carregar(): CarrinhoSnapshot | null;
  limpar(): void;
}

export interface IUsuarioRepository {
  buscarTodos(): Usuario[];
  buscarPorLogin(nomeOuEmail: string): Usuario | undefined;
  inserir(dados: { nome: string; email: string; senhaHash: string; papel: 'OPERADOR' | 'GERENTE' }): void;
  contar(): number;
}

export interface ICaixaRepository {
  salvarEstado(e: EstadoPersistidoCaixa): void;
  carregarEstado(): EstadoPersistidoCaixa | null;
  salvarFechamento(r: RelatorioFechamento): void;
  listarFechamentos(): RelatorioFechamento[];
}
