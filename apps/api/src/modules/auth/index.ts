import type { FastifyPluginAsync } from 'fastify';

import type { Executor } from '@/shared/db/transaction';

import { createAuthenticate } from './hooks';
import { createSessionsRepository } from './repositories/sessions';
import { createUsersRepository } from './repositories/users';
import { type AuthConfig, authRoutes } from './routes';

export const AUTH_PATH = '/api/v1/auth';

export interface AuthModuleDeps {
  db: Executor;
  config: AuthConfig;
  now: () => Date;
}

/**
 * Módulo de autenticação: monta os próprios repositórios (ADR-007) e expõe só o necessário aos
 * demais módulos: o hook `authenticate` e o plugin com as rotas.
 */
export function authModule({ db, config, now }: AuthModuleDeps) {
  const sessions = createSessionsRepository(db);
  const authenticate = createAuthenticate({
    sessions,
    policy: config.policy,
    cookie: config.cookie,
    now,
  });
  const plugin: FastifyPluginAsync = async (app) => {
    await app.register(authRoutes, {
      prefix: AUTH_PATH,
      users: createUsersRepository(db),
      sessions,
      ...config,
      authenticate,
      now,
    });
  };
  return { authenticate, plugin };
}
