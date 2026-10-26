import type { User } from '@contatos/contracts';

import { type AppDeps, buildApp } from '@/app';
import { type AuthConfig, authConfigFromEnv } from '@/modules/auth/routes';
import { loadEnv } from '@/shared/config/env';
import type { Database } from '@/shared/db/client';
import type { JobQueue } from '@/shared/queue/job-queue';

export type TestApp = Awaited<ReturnType<typeof buildApp>>;

export const CSRF_HEADERS = { 'x-requested-with': 'fetch' } as const;

const GENEROUS_LIMIT = { max: 10_000, timeWindowMs: 60_000 };

/** Limites folgados: suítes cadastram vários usuários; o 429 é testado com limites próprios. */
export const testAuthConfig: AuthConfig = {
  ...authConfigFromEnv(loadEnv({ NODE_ENV: 'test', DATABASE_URL: 'postgres://localhost/test' })),
  rateLimits: { perIp: GENEROUS_LIMIT, perAccount: GENEROUS_LIMIT },
};

/** Suítes que não importam CSV não sobem o pg-boss; usar a fila sem configurá-la é erro explícito. */
export const unconfiguredJobQueue: JobQueue = {
  enqueue: () => Promise.reject(new Error('Fila não configurada neste teste')),
};

export function buildTestApp(
  db: Pick<Database, 'ping' | 'orm'>,
  overrides: Partial<Omit<AppDeps, 'db'>> = {},
): Promise<TestApp> {
  return buildApp({
    db,
    auth: testAuthConfig,
    jobQueue: unconfiguredJobQueue,
    importMaxBytes: 5_242_880,
    ...overrides,
  });
}

let sequence = 0;

export function newRegistration(
  overrides: Partial<{ name: string; email: string; password: string }> = {},
) {
  sequence += 1;
  return {
    name: `Pessoa ${sequence}`,
    email: `pessoa${sequence}@exemplo.com`,
    password: 'senha-forte-123',
    ...overrides,
  };
}

/** Cadastra pela API e devolve o usuário e o cabeçalho `cookie` da sessão. */
export async function registerUser(
  app: TestApp,
  registration = newRegistration(),
): Promise<{ user: User; cookie: string }> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    headers: CSRF_HEADERS,
    payload: registration,
  });
  if (response.statusCode !== 201) throw new Error(`cadastro falhou: ${response.body}`);
  const [sessionCookie] = response.cookies;
  if (!sessionCookie) throw new Error('cadastro sem cookie de sessão');
  return { user: response.json<User>(), cookie: `${sessionCookie.name}=${sessionCookie.value}` };
}
