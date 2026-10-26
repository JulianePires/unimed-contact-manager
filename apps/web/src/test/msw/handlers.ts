import {
  importSchema,
  loginInputSchema,
  pageSchema,
  registerInputSchema,
  type User,
  userSchema,
} from '@contatos/contracts';
import { HttpResponse, http } from 'msw';

import { contactHandlers } from './contacts';
import { parseBody, problem } from './problem';

export { problem };

export const API = '/api/v1';

/** Usuário da sessão nos testes; validado pelo mesmo schema que a API usa. */
export const sessionUser: User = userSchema.parse({
  id: '0192f3a1-0000-7000-8000-000000000001',
  name: 'Maria Silva',
  email: 'maria@empresa.com',
});

/** Senha aceita pelo login simulado para `sessionUser`. */
export const sessionPassword = 'senha-correta-123';

const emptyPage = { data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };

/** Visitante sem sessão (ou sessão expirada): `server.use(unauthenticatedMe)`. */
export const unauthenticatedMe = http.get(`${API}/auth/me`, () =>
  problem('UNAUTHENTICATED', 'Sessão expirada'),
);

/** Cenário padrão: sessão ativa, agenda simulada (contacts.ts) e nenhuma importação. Cada teste ajusta com `server.use(...)`. */
export const handlers = [
  http.get(`${API}/auth/me`, () => HttpResponse.json(sessionUser)),

  http.post(`${API}/auth/login`, async ({ request }) => {
    const body = await parseBody(request, loginInputSchema);
    if (!body.ok) return body.response;
    const valid = body.data.email === sessionUser.email && body.data.password === sessionPassword;
    return valid
      ? HttpResponse.json(sessionUser)
      : problem('INVALID_CREDENTIALS', 'E-mail ou senha inválidos');
  }),

  http.post(`${API}/auth/register`, async ({ request }) => {
    const body = await parseBody(request, registerInputSchema);
    if (!body.ok) return body.response;
    if (body.data.email === sessionUser.email) {
      return problem('REGISTRATION_FAILED', 'Não foi possível concluir o cadastro');
    }
    return HttpResponse.json(
      userSchema.parse({ ...sessionUser, name: body.data.name, email: body.data.email }),
      { status: 201 },
    );
  }),

  http.post(`${API}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  http.post(`${API}/auth/logout-all`, () => new HttpResponse(null, { status: 204 })),

  ...contactHandlers,
  http.get(`${API}/imports`, () => HttpResponse.json(pageSchema(importSchema).parse(emptyPage))),
];
