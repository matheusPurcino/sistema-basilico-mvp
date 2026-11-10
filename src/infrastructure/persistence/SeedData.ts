import {
  DIA_MS,
  ItemVenda,
  PedidoDelivery,
  type IPedidoRepository,
  type IProdutoRepository,
  type IUsuarioRepository,
  type NovoProduto,
} from '../../domain';
import { HASH_PADRAO_GERENTE, HASH_PADRAO_OPERADOR } from '../security/BcryptHasher';

export const CREDENCIAIS_HOMOLOGACAO = {
  operador: {
    login: 'operador',
    email: 'operador@basilico.com.br',
    senhaPura: 'Operador@123',
    papel: 'OPERADOR' as const,
  },
  gerente: {
    login: 'gerente',
    email: 'gerente@basilico.com.br',
    senhaPura: 'Gerente@123',
    papel: 'GERENTE' as const,
  },
} as const;

export const CATALOGO_INICIAL_BASILICO: readonly NovoProduto[] = [
  {
    nome: 'Bruschetta al Pomodoro & Basílico',
    descricao: 'Pão italiano rústico tostado com tomates concassé, alho confitado, azeite extravirgem e manjericão fresco.',
    categoria: 'ENTRADAS',
    precoCentavos: 2890,
    ativo: true,
  },
  {
    nome: 'Burrata Cremosa di Puglia',
    descricao: 'Burrata artesanal servida com pesto genovês, tomates cereja assados e focaccia da casa.',
    categoria: 'ENTRADAS',
    precoCentavos: 4990,
    ativo: true,
  },
  {
    nome: 'Fettuccine Alfredo com Filé Mignon',
    descricao: 'Massa fresca artesanal ao molho cremoso de Grana Padano com medalhões de filé mignon grelhados.',
    categoria: 'MASSAS',
    precoCentavos: 6490,
    ativo: true,
  },
  {
    nome: 'Gnocchi alla Sorrentina',
    descricao: 'Nhoque de batata asterix gratinado ao forno com molho San Marzano, mozzarella de búfala e manjericão.',
    categoria: 'MASSAS',
    precoCentavos: 5490,
    ativo: true,
  },
  {
    nome: 'Spaghetti alla Carbonara Tradizionale',
    descricao: 'Guanciale crocante, gemas caipiras, Pecorino Romano DOP e pimenta-do-reino moída na hora.',
    categoria: 'MASSAS',
    precoCentavos: 5890,
    ativo: true,
  },
  {
    nome: 'Lasagna Bolognese della Nonna',
    descricao: 'Camadas de massa verde artesanal com ragu de vitelo cozido lentamente por 6 horas e bechamel.',
    categoria: 'MASSAS',
    precoCentavos: 5990,
    ativo: true,
  },
  {
    nome: 'Pizza Margherita Verace Napoletana',
    descricao: 'Fermentação natural 48h, molho de tomate San Marzano, fior di latte e folhas de basílico.',
    categoria: 'PIZZAS',
    precoCentavos: 6200,
    ativo: true,
  },
  {
    nome: 'Pizza Diavola & Mel Trufado',
    descricao: 'Salame spianata picante, fior di latte, tomate italiano e fio de mel silvestre trufado.',
    categoria: 'PIZZAS',
    precoCentavos: 7190,
    ativo: true,
  },
  {
    nome: 'Risotto ai Funghi Porcini',
    descricao: 'Arroz Carnaroli cremoso com cogumelos porcini italianos, manteiga de trufas e Parmigiano Reggiano.',
    categoria: 'RISOTOS',
    precoCentavos: 6890,
    ativo: true,
  },
  {
    nome: 'Risotto de Camarão Siciliano',
    descricao: 'Camarões rosa grelhados, raspas de limão siciliano, alho-poró e toque de prosecco.',
    categoria: 'RISOTOS',
    precoCentavos: 7990,
    ativo: true,
  },
  {
    nome: 'Tiramisù Classico di Treviso',
    descricao: 'Biscoitos savoiardi embebidos em espresso italiano, creme de mascarpone e cacau belga 70%.',
    categoria: 'SOBREMESAS',
    precoCentavos: 3190,
    ativo: true,
  },
  {
    nome: 'Cannoli Siciliani (Dupla)',
    descricao: 'Massa crocante recheada na hora com ricota doce cremosa, pistache de Bronte e laranja cristalizada.',
    categoria: 'SOBREMESAS',
    precoCentavos: 2990,
    ativo: true,
  },
  {
    nome: 'Soda Italiana de Maçã Verde & Manjericão',
    descricao: 'Xarope artesanal da casa com água com gás gelada e folhas frescas de basílico (350ml).',
    categoria: 'BEBIDAS',
    precoCentavos: 1590,
    ativo: true,
  },
  {
    nome: 'Vinho Chianti Classico DOCG (Taça 180ml)',
    descricao: 'Tinto toscano encorpado de uvas Sangiovese, notas de cereja madura e especiarias.',
    categoria: 'BEBIDAS',
    precoCentavos: 3690,
    ativo: true,
  },
];

export const TELEFONE_CLIENTE_FIDELIZADO_DEMO = '(35) 99999-0001';

export function popularDadosIniciais(
  usuarios: IUsuarioRepository,
  produtos: IProdutoRepository,
  pedidos: IPedidoRepository,
  agora: Date = new Date(),
): void {
  if (usuarios.contar() === 0) {
    usuarios.inserir({
      nome: CREDENCIAIS_HOMOLOGACAO.operador.login,
      email: CREDENCIAIS_HOMOLOGACAO.operador.email,
      senhaHash: HASH_PADRAO_OPERADOR,
      papel: 'OPERADOR',
    });
    usuarios.inserir({
      nome: CREDENCIAIS_HOMOLOGACAO.gerente.login,
      email: CREDENCIAIS_HOMOLOGACAO.gerente.email,
      senhaHash: HASH_PADRAO_GERENTE,
      papel: 'GERENTE',
    });
  }

  if (produtos.contar() === 0) {
    for (const p of CATALOGO_INICIAL_BASILICO) {
      produtos.criar(p);
    }
  }

  if (pedidos.listar().length === 0) {
    // 1) Pedido iFood ativo aguardando aceite
    const p1 = new PedidoDelivery({
      codigoExterno: 'IFOOD-8841',
      plataforma: 'IFOOD',
      clienteNome: 'Ana Clara Ribeiro',
      clienteTelefone: '(35) 99124-7788',
      clienteEndereco: 'Av. Dr. Lisboa, 412 - Centro, Pouso Alegre/MG',
      itens: [
        new ItemVenda(3, 'Fettuccine Alfredo com Filé Mignon', 1, 6490),
        new ItemVenda(13, 'Soda Italiana de Maçã Verde & Manjericão', 2, 1590),
      ],
      dataCriacao: new Date(agora.getTime() - 2 * 60_000),
    });
    pedidos.inserir(p1);

    // 2) Pedido Aiqfome ativo aguardando aceite
    const p2 = new PedidoDelivery({
      codigoExterno: 'AIQ-3309',
      plataforma: 'AIQFOME',
      clienteNome: 'Bruno Silveira Costa',
      clienteTelefone: '(35) 98802-4411',
      clienteEndereco: 'Rua Comendador José Garcia, 815 - Santa Elisa, Pouso Alegre/MG',
      itens: [
        new ItemVenda(7, 'Pizza Margherita Verace Napoletana', 1, 6200),
        new ItemVenda(11, 'Tiramisù Classico di Treviso', 1, 3190),
      ],
      dataCriacao: new Date(agora.getTime() - 4 * 60_000),
    });
    pedidos.inserir(p2);

    // 3) Pedido histórico com prazo LGPD vencido (> 180 dias, cliente NÃO fidelizado) para demonstrar RE01
    const pAntigo = new PedidoDelivery({
      codigoExterno: 'IFOOD-1042',
      plataforma: 'IFOOD',
      clienteNome: 'Carlos Eduardo Mendes (Prazo Vencido)',
      clienteTelefone: '(35) 98411-2233',
      clienteEndereco: 'Rua Adolpho Olinto, 190 - Centro, Pouso Alegre/MG',
      itens: [new ItemVenda(9, 'Risotto ai Funghi Porcini', 1, 6890)],
      dataCriacao: new Date(agora.getTime() - 210 * DIA_MS),
    });
    pedidos.inserir(pAntigo);
  }
}
