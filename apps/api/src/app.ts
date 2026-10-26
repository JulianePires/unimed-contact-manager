import { randomUUID } from 'node:crypto';

import fastifyCookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyRequest, type FastifyServerOptions } from 'fastify';

import { createAuthenticate, requireCsrfHeader } from '@/modules/auth/hooks';
import { createSessionsRepository } from '@/modules/auth/repositories/sessions';
import { createUsersRepository } from '@/modules/auth/repositories/users';
import { type AuthConfig, authRoutes } from '@/modules/auth/routes';
import type { Database } from '@/shared/db/client';
import { AppError, toProblemDetails } from '@/shared/errors';
import { healthRoutes } from '@/shared/http/health';

export interface AppDeps {
  db: Pick<Database, 'ping' | 'orm'>;
  auth: AuthConfig;
  now?: () => Date;
  logger?: FastifyServerOptions['logger'];
  webRoot?: string | undefined;
}

function pathOf(url: string): string {
  const queryStart = url.indexOf('?');
  return queryStart === -1 ? url : url.slice(0, queryStart);
}

function isSpaRoute(request: FastifyRequest, path: string): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (path === '/api' || path.startsWith('/api/')) return false;
  return !path.slice(path.lastIndexOf('/') + 1).includes('.');
}

export async function buildApp({
  db,
  auth,
  now = () => new Date(),
  logger = false,
  webRoot,
}: AppDeps) {
  const app = Fastify({ logger, genReqId: () => randomUUID() });

  await app.register(helmet);
  await app.register(fastifyCookie);
  await app.register(fastifyRateLimit, { global: false });
  app.decorateRequest('user', null);
  app.addHook('onRequest', requireCsrfHeader);

  app.setErrorHandler((error, request, reply) => {
    const problem = toProblemDetails(error, {
      instance: pathOf(request.url),
      requestId: request.id,
    });
    if (problem.status >= 500) request.log.error({ err: error }, problem.title);
    return reply.status(problem.status).type('application/problem+json').send(problem);
  });

  app.setNotFoundHandler((request, reply) => {
    if (webRoot !== undefined && isSpaRoute(request, pathOf(request.url))) {
      return reply.sendFile('index.html');
    }
    throw new AppError(404, 'NOT_FOUND', 'Recurso não encontrado');
  });

  if (webRoot !== undefined) {
    await app.register(fastifyStatic, {
      root: webRoot,
      cacheControl: false,
      setHeaders: (reply, filePath) => {
        const hashed = /[\\/]assets[\\/]/.test(filePath);
        reply.header('cache-control', hashed ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    });
  }

  await app.register(healthRoutes, { db });

  const sessions = createSessionsRepository(db.orm);
  const authenticate = createAuthenticate({
    sessions,
    policy: auth.policy,
    cookie: auth.cookie,
    now,
  });
  await app.register(authRoutes, {
    prefix: '/api/v1/auth',
    users: createUsersRepository(db.orm),
    sessions,
    ...auth,
    authenticate,
    now,
  });

  return app;
}
