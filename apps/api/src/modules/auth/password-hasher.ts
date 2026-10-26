import { argon2id, hash, verify } from 'argon2';

import { PASSWORD_HASH_PARAMS } from './domain/password-policy';

export function hashPassword(password: string): Promise<string> {
  return hash(password, { type: argon2id, ...PASSWORD_HASH_PARAMS });
}

const dummyHash = hashPassword('usuario-inexistente');

/**
 * Sem usuário, verifica contra um hash fictício com os mesmos parâmetros: o tempo de resposta
 * não revela se o e-mail existe.
 */
export async function verifyPassword(
  passwordHash: string | undefined,
  password: string,
): Promise<boolean> {
  if (passwordHash !== undefined) return verify(passwordHash, password);
  await verify(await dummyHash, password);
  return false;
}
