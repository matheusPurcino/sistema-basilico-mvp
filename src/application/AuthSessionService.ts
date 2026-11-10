import {
  AutenticacaoError,
  Gerente,
  MINUTO_MS,
  PermissaoNegadaError,
  RelogioSistema,
  SessaoBloqueadaError,
  type Clock,
  type IAuditLogRepository,
  type IUsuarioRepository,
  type Usuario,
  type VerificadorSenha,
} from '../domain';
import { HASH_PADRAO_OPERADOR } from '../infrastructure/security/BcryptHasher';

export const TIMEOUT_INATIVIDADE_MS = 30 * MINUTO_MS;

/**
 * AuthSessionService — Autenticação RBAC, Cache Local Cifrado e Controle de
 * Inatividade de 30 minutos (RF05 / RNF05.1 a RNF05.4 / CT04 / CT12).
 */
export class AuthSessionService {
  private usuarioAtual: Usuario | null = null;
  private ultimaAtividadeMs: number | null = null;
  private bloqueadaPorInatividade = false;
  private ultimoTempoAutenticacaoMs = 0;
  private readonly relogio: Clock;

  constructor(
    private readonly usuariosRepo: IUsuarioRepository,
    private readonly auditRepo: IAuditLogRepository,
    private readonly verificador: VerificadorSenha,
    relogio?: Clock,
  ) {
    this.relogio = relogio ?? new RelogioSistema();
  }

  /**
   * Login 100% offline contra o SQLite local cifrado.
   * RNF05.4: lança SEMPRE `AutenticacaoError` com mensagem genérica sem revelar
   * se foi o login ou a senha que falhou.
   */
  login(nomeOuEmail: string, senhaPura: string): Usuario {
    const inicio = performance.now();
    const candidato = this.usuariosRepo.buscarPorLogin(nomeOuEmail);

    if (!candidato) {
      // Mitigação de timing attack: executa verificação contra hash dummy
      this.verificador.verificar(senhaPura, HASH_PADRAO_OPERADOR);
      this.registrarFalhaLogin();
      throw new AutenticacaoError();
    }

    const ok = candidato.autenticar(nomeOuEmail, senhaPura);
    if (!ok) {
      this.registrarFalhaLogin();
      throw new AutenticacaoError();
    }

    this.ultimoTempoAutenticacaoMs = Math.max(1, Math.round(performance.now() - inicio));
    this.usuarioAtual = candidato;
    this.ultimaAtividadeMs = this.relogio.agora().getTime();
    this.bloqueadaPorInatividade = false;

    this.auditRepo.registrar({
      dataHora: this.relogio.agora().toISOString(),
      usuario: candidato.getNome(),
      acao: 'LOGIN_SUCESSO',
      categoria: 'SEGURANCA',
      entidadeId: String(candidato.getId()),
      detalhes: `Sessão autenticada offline como ${candidato.getPapel()} em ${this.ultimoTempoAutenticacaoMs}ms.`,
    });

    return candidato;
  }

  private registrarFalhaLogin(): void {
    this.auditRepo.registrar({
      dataHora: this.relogio.agora().toISOString(),
      usuario: 'ANONIMO',
      acao: 'LOGIN_FALHA',
      categoria: 'SEGURANCA',
      entidadeId: null,
      detalhes: AutenticacaoError.MENSAGEM_GENERICA,
    });
  }

  logout(): void {
    if (this.usuarioAtual) {
      const nome = this.usuarioAtual.getNome();
      this.usuarioAtual.deslogar();
      this.auditRepo.registrar({
        dataHora: this.relogio.agora().toISOString(),
        usuario: nome,
        acao: 'LOGOUT',
        categoria: 'SEGURANCA',
        entidadeId: null,
        detalhes: 'Sessão encerrada pelo usuário.',
      });
    }
    this.usuarioAtual = null;
    this.ultimaAtividadeMs = null;
    this.bloqueadaPorInatividade = false;
  }

  /**
   * Verifica se o tempo desde a última interação ultrapassou 30 minutos
   * (RNF05.3 / CT04). Caso positivo, bloqueia a sessão imediatamente.
   */
  verificarInatividade(): boolean {
    if (!this.usuarioAtual || this.ultimaAtividadeMs === null) return false;
    const decorrido = this.relogio.agora().getTime() - this.ultimaAtividadeMs;
    if (decorrido >= TIMEOUT_INATIVIDADE_MS) {
      const nome = this.usuarioAtual.getNome();
      this.usuarioAtual.deslogar();
      this.bloqueadaPorInatividade = true;
      this.auditRepo.registrar({
        dataHora: this.relogio.agora().toISOString(),
        usuario: nome,
        acao: 'SESSAO_BLOQUEADA_INATIVIDADE',
        categoria: 'SEGURANCA',
        entidadeId: null,
        detalhes: `Sessão bloqueada automaticamente após ${Math.floor(decorrido / 60_000)} minutos de inatividade (RNF05.3).`,
      });
      return true;
    }
    return false;
  }

  registrarAtividade(): void {
    if (this.verificarInatividade()) {
      throw new SessaoBloqueadaError();
    }
    if (this.usuarioAtual) {
      this.ultimaAtividadeMs = this.relogio.agora().getTime();
    }
  }

  exigirSessaoAtiva(): Usuario {
    if (this.verificarInatividade() || this.bloqueadaPorInatividade) {
      throw new SessaoBloqueadaError();
    }
    if (!this.usuarioAtual || !this.usuarioAtual.estaAutenticado()) {
      throw new PermissaoNegadaError('Nenhum usuário autenticado na sessão.');
    }
    this.ultimaAtividadeMs = this.relogio.agora().getTime();
    return this.usuarioAtual;
  }

  /**
   * Valida credencial de Gerente para autorizar estorno (RN02 / CT02).
   * Se o usuário já logado for Gerente e não forem passadas credenciais extras,
   * retorna a própria instância de `Gerente`. Se o usuário logado for `OPERADOR`
   * e tentar estornar sem credencial de `Gerente`, lança `PermissaoNegadaError`.
   */
  obterGerenteAutorizado(credencialGerente?: { login: string; senhaPura: string }): Gerente {
    const sessao = this.exigirSessaoAtiva();

    if (credencialGerente) {
      const candidato = this.usuariosRepo.buscarPorLogin(credencialGerente.login);
      if (!candidato || !(candidato instanceof Gerente)) {
        this.verificador.verificar(credencialGerente.senhaPura, HASH_PADRAO_OPERADOR);
        throw new PermissaoNegadaError('Credencial de Gerente inválida ou sem privilégio GERENTE (RN02).');
      }
      if (!candidato.autenticar(credencialGerente.login, credencialGerente.senhaPura)) {
        throw new AutenticacaoError();
      }
      return candidato;
    }

    if (sessao instanceof Gerente) {
      return sessao;
    }

    throw new PermissaoNegadaError(
      `RN02: Operador "${sessao.getNome()}" não possui permissão para autorizar estorno. Exclusivo do perfil GERENTE.`,
    );
  }

  getUsuarioAtual(): Usuario | null {
    this.verificarInatividade();
    if (this.bloqueadaPorInatividade) return null;
    return this.usuarioAtual;
  }

  isBloqueadaPorInatividade(): boolean {
    this.verificarInatividade();
    return this.bloqueadaPorInatividade;
  }

  getUltimoTempoAutenticacaoMs(): number {
    return this.ultimoTempoAutenticacaoMs;
  }
}
