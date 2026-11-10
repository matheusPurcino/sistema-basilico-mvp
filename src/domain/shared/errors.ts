/** Hierarquia de erros de domínio do Sistema Basílico. */
export class DomainError extends Error {
  readonly codigo: string;
  constructor(mensagem: string, codigo = 'ERRO_DOMINIO') {
    super(mensagem);
    this.name = new.target.name;
    this.codigo = codigo;
  }
}

/** RN02 / RF05 — tentativa de operação sem o papel necessário. */
export class PermissaoNegadaError extends DomainError {
  constructor(mensagem = 'Permissão negada: operação exclusiva do perfil GERENTE.') {
    super(mensagem, 'PERMISSAO_NEGADA');
  }
}

/**
 * RNF05.4 — mensagem SEMPRE genérica. Nunca revela se o usuário existe
 * ou se foi a senha que falhou.
 */
export class AutenticacaoError extends DomainError {
  static readonly MENSAGEM_GENERICA = 'Credenciais inválidas. Verifique os dados e tente novamente.';
  constructor() {
    super(AutenticacaoError.MENSAGEM_GENERICA, 'AUTENTICACAO_FALHOU');
  }
}

export class SessaoBloqueadaError extends DomainError {
  constructor() {
    super('Sessão bloqueada por inatividade (30 min). Autentique-se novamente.', 'SESSAO_BLOQUEADA');
  }
}

export class CaixaFechadoError extends DomainError {
  constructor() {
    super('O caixa está fechado. Abra o caixa antes de registrar vendas.', 'CAIXA_FECHADO');
  }
}

export class TransicaoInvalidaError extends DomainError {
  constructor(entidade: string, de: string, para: string) {
    super(`Transição inválida em ${entidade}: ${de} → ${para}.`, 'TRANSICAO_INVALIDA');
  }
}
