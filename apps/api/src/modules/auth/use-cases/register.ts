import type { RegisterInput, User } from '@contatos/contracts';

import { AppError } from '@/shared/errors';

import { hashPassword } from '../password-hasher';
import type { UsersRepository } from '../repositories/users';
import { type ClientInfo, type SessionDeps, startSession } from './start-session';
import { toUserDto } from './me';

export interface RegisterDeps extends SessionDeps {
  users: UsersRepository;
}

export async function register(
  deps: RegisterDeps,
  input: RegisterInput,
  client: ClientInfo,
): Promise<{ user: User; sessionToken: string }> {
  const user = await deps.users.insert({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
  });
  if (!user) {
    // Mensagem genérica: não confirma se o e-mail já tem conta (UC01 FE1)
    throw new AppError(409, 'REGISTRATION_FAILED', 'Não foi possível concluir o cadastro');
  }
  const sessionToken = await startSession(deps, user.id, client);
  return { user: toUserDto(user), sessionToken };
}
