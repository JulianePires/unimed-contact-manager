import { userSchema } from '@contatos/contracts';
import { queryOptions } from '@tanstack/react-query';

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

/** A área autenticada trata o 401 ao sair (sessão já encerrada), sem recarregar a página. */
export function logout(): Promise<void> {
  return request('POST', `${AUTH_PATH}/logout`, { redirectOnUnauthorized: false });
}

export function logoutAll(): Promise<void> {
  return request('POST', `${AUTH_PATH}/logout-all`, { redirectOnUnauthorized: false });
}
