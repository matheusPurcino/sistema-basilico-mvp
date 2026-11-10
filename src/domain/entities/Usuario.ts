import { PermissaoNegadaError } from '../shared/errors';

export type Papel = 'OPERADOR' | 'GERENTE';

/** Porta para verificação de hash de senha (bcrypt na infraestrutura). */
export interface VerificadorSenha {
  verificar(senhaPura: string, hash: string): boolean;
}

export interface DadosUsuario {
  id: number;
  nome: string;
  email: string;
  senhaHash: string;
}

/**
 * Usuario (abstrata) — Figura 2. Atributos `#` (protegidos) conforme a UML.
 */
export abstract class Usuario {
  protected id: number;
  protected nome: string;
  protected email: string;
  protected senhaHash: string;
  protected papel: Papel;
  private autenticado = false;

  protected constructor(
    dados: DadosUsuario,
    papel: Papel,
    protected readonly verificador: VerificadorSenha,
  ) {
    this.id = dados.id;
    this.nome = dados.nome;
    this.email = dados.email;
    this.senhaHash = dados.senhaHash;
    this.papel = papel;
  }

  /**
   * Autentica por nome de usuário OU e-mail. O hash é SEMPRE verificado,
   * mesmo quando o identificador não confere, evitando side-channel de
   * tempo que revelaria qual campo falhou (RNF05.4).
   */
  autenticar(nomeOuEmail: string, senhaPura: string): boolean {
    const alvo = nomeOuEmail.trim().toLowerCase();
    const identificadorConfere = alvo === this.nome.toLowerCase() || alvo === this.email.toLowerCase();
    const senhaConfere = this.verificador.verificar(senhaPura, this.senhaHash);
    this.autenticado = identificadorConfere && senhaConfere;
    return this.autenticado;
  }

  deslogar(): void {
    this.autenticado = false;
  }

  estaAutenticado(): boolean {
    return this.autenticado;
  }

  protected exigirAutenticacao(acao: string): void {
    if (!this.autenticado) {
      throw new PermissaoNegadaError(`Usuário "${this.nome}" precisa estar autenticado para ${acao}.`);
    }
  }

  getId(): number {
    return this.id;
  }
  getNome(): string {
    return this.nome;
  }
  getEmail(): string {
    return this.email;
  }
  getPapel(): Papel {
    return this.papel;
  }
  getSenhaHash(): string {
    return this.senhaHash;
  }
}
