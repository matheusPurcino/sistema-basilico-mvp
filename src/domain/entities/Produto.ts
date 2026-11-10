import { DomainError } from '../shared/errors';
import { assertCentavosNaoNegativos } from '../shared/Money';

export const CATEGORIAS_PRODUTO = ['ENTRADAS', 'MASSAS', 'PIZZAS', 'RISOTOS', 'SOBREMESAS', 'BEBIDAS'] as const;
export type CategoriaProduto = (typeof CATEGORIAS_PRODUTO)[number];

export interface Produto {
  id: number;
  nome: string;
  descricao: string;
  categoria: CategoriaProduto;
  precoCentavos: number;
  ativo: boolean;
}

export type NovoProduto = Omit<Produto, 'id'>;

/** Regras de validação do cadastro de produtos (CRUD — Nível Intermediário). */
export function validarProduto(p: NovoProduto): NovoProduto {
  const nome = p.nome?.trim();
  if (!nome || nome.length < 2) throw new DomainError('Nome do produto deve ter ao menos 2 caracteres.');
  if (nome.length > 60) throw new DomainError('Nome do produto deve ter no máximo 60 caracteres.');
  if (!(CATEGORIAS_PRODUTO as readonly string[]).includes(p.categoria)) {
    throw new DomainError('Categoria inválida.');
  }
  assertCentavosNaoNegativos(p.precoCentavos, 'preço');
  if (p.precoCentavos === 0) throw new DomainError('Preço deve ser maior que zero.');
  return { ...p, nome, descricao: (p.descricao ?? '').trim() };
}
