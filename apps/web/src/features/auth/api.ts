import { type LoginInput, type RegisterInput, type User, userSchema } from '@contatos/contracts';
import { type QueryClient, queryOptions } from '@tanstack/react-query';

import { request } from '@/lib/http';

const AUTH_PATH = '/api/v1/auth';

/**
 * Sessão atual (docs/06 §6.3). O guard da área autenticada trata o 401 e redireciona pelo router,
 * por isso esta consulta não usa o redirect automático do cliente HTTP.
 */
export const meQueryOptions = queryOptions({
  queryKey: ['me'],
  queryFn: ({ signal }) =>
    request('GET', `${AUTH_PATH}/me`, {
      schema: userSchema,
      signal,
      redirectOnUnauthorized: false,
    }),
  staleTime: 'static',
  retry: false,
});

/** Sem sessão ou API fora do ar: `null`, para telas públicas decidirem sem lançar erro. */
export async function currentUser(queryClient: QueryClient): Promise<User | null> {
  try {
    return await queryClient.query(meQueryOptions);
  } catch {
    return null;
  }
}

/** Nova sessão começa sem dados de outra conta em memória (ADR-009 §4). */
export function startSession(queryClient: QueryClient, user: User): void {
  queryClient.removeQueries();
  queryClient.setQueryData(meQueryOptions.queryKey, user);
}

export function login(input: LoginInput): Promise<User> {
  return request('POST', `${AUTH_PATH}/login`, {
    body: input,
    schema: userSchema,
    redirectOnUnauthorized: false,
  });
}

export function register(input: RegisterInput): Promise<User> {
  return request('POST', `${AUTH_PATH}/register`, { body: input, schema: userSchema });
}

/** A área autenticada trata o 401 ao sair (sessão já encerrada), sem recarregar a página. */
export function logout(): Promise<void> {
  return request('POST', `${AUTH_PATH}/logout`, { redirectOnUnauthorized: false });
}

export function logoutAll(): Promise<void> {
  return request('POST', `${AUTH_PATH}/logout-all`, { redirectOnUnauthorized: false });
}
