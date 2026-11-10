import bcrypt from 'bcryptjs';
import { DomainError, type VerificadorSenha } from '../../domain';

export const CUSTO_MINIMO_BCRYPT = 12;

/**
 * Hashes reais bcrypt (custo 12) dos usuários padrão para seed instantâneo,
 * 100% verificáveis por `bcrypt.compareSync` e `bcrypt.getRounds` (CT04 / CT12).
 *
 * - Operador: `operador` / `operador@basilico.com.br` → senha `Operador@123`
 * - Gerente : `gerente`  / `gerente@basilico.com.br`  → senha `Gerente@123`
 */
export const HASH_PADRAO_OPERADOR = '$2b$12$08Cwl/4j8MUqmU5R6hgviO5.47.AnuGGFj4QUawEzeZJrYNN86S4G';
export const HASH_PADRAO_GERENTE = '$2b$12$WMc48/E5hlRuS3IRSE.tHOA15JEAcaoWig8Lw/jO7RSzYKPh2zwVC';

/**
 * Implementação de `VerificadorSenha` com `bcryptjs` (RNF05.1 / CT04).
 * Exige fator de trabalho (cost) >= 12.
 */
export class BcryptHasher implements VerificadorSenha {
  gerarHash(senhaPura: string, custo: number = CUSTO_MINIMO_BCRYPT): string {
    if (!Number.isInteger(custo) || custo < CUSTO_MINIMO_BCRYPT) {
      throw new DomainError(`RNF05.1: custo do bcrypt deve ser >= ${CUSTO_MINIMO_BCRYPT} (recebido: ${custo}).`);
    }
    if (!senhaPura || senhaPura.length < 6) {
      throw new DomainError('A senha deve possuir ao menos 6 caracteres.');
    }
    return bcrypt.hashSync(senhaPura, custo);
  }

  verificar(senhaPura: string, hash: string): boolean {
    if (!senhaPura || !hash) return false;
    try {
      return bcrypt.compareSync(senhaPura, hash);
    } catch {
      return false;
    }
  }

  extrairCusto(hash: string): number {
    try {
      return bcrypt.getRounds(hash);
    } catch {
      return 0;
    }
  }
}
