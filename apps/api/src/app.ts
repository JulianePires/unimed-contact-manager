import { randomUUID } from 'node:crypto';

import helmet from '@fastify/helmet';
import Fastify, { type FastifyServerOptions } from 'fastify';

import type { Database } from './shared/db/client';
import { AppError, toProblemDetails } from './shared/errors';
import { healthRoutes } from './shared/http/health';

export interface AppDeps {
  db: Pick<Database, 'ping'>;
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp({ db, logger = false }: AppDeps) {
  const app = Fastify({ logger, genReqId: () => randomUUID() });

  await app.register(helmet);

  app.setErrorHandler((error, request, reply) => {
    const instance = request.url.split('?', 1)[0] ?? request.url;
    const problem = toProblemDetails(error, { instance, requestId: request.id });
    if (problem.status >= 500) request.log.error({ err: error }, problem.title);
    return reply.status(problem.status).type('application/problem+json').send(problem);
  });

  app.setNotFoundHandler(() => {
    throw new AppError(404, 'NOT_FOUND', 'Recurso não encontrado');
  });

  await app.register(healthRoutes, { db });

  return app;
}
