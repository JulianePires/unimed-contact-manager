import type { LoginInput, User } from '@contatos/contracts';

import { AppError } from '@/shared/errors';

import { verifyPassword } from '../password-hasher';
import type { UsersRepository } from '../repositories/users';
import { toUserDto } from './me';
import { type ClientInfo, type SessionDeps, startSession } from './start-session';

export interface LoginDeps extends SessionDeps {
  users: UsersRepository;
}

export async function login(
  deps: LoginDeps,
  input: LoginInput,
  client: ClientInfo,
): Promise<{ user: User; sessionToken: string }> {
  const user = await deps.users.findByEmail(input.email);
  const valid = await verifyPassword(user?.passwordHash, input.password);
  if (!user || !valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos');
  }
  const sessionToken = await startSession(deps, user.id, client);
  return { user: toUserDto(user), sessionToken };
}
