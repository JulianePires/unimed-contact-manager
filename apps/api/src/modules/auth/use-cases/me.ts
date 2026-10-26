import type { User } from '@contatos/contracts';

export function toUserDto({ id, name, email }: User): User {
  return { id, name, email };
}

/** O usuário já vem carregado com a sessão pelo hook `authenticate`. */
export function me(user: User): User {
  return toUserDto(user);
}
