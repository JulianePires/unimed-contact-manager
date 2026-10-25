import { randomUUID } from 'node:crypto';

import helmet from '@fastify/helmet';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyRequest, type FastifyServerOptions } from 'fastify';

import type { Database } from './shared/db/client';
import { AppError, toProblemDetails } from './shared/errors';
import { healthRoutes } from './shared/http/health';

export interface AppDeps {
  db: Pick<Database, 'ping'>;
  logger?: FastifyServerOptions['logger'];
  webRoot?: string | undefined;
}

function isSpaRoute(request: FastifyRequest, path: string): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;
  if (path === '/api' || path.startsWith('/api/')) return false;
  return !path.slice(path.lastIndexOf('/') + 1).includes('.');
}

export async function buildApp({ db, logger = false, webRoot }: AppDeps) {
  const app = Fastify({ logger, genReqId: () => randomUUID() });

  await app.register(helmet);

  app.setErrorHandler((error, request, reply) => {
    const instance = request.url.split('?', 1)[0] ?? request.url;
    const problem = toProblemDetails(error, { instance, requestId: request.id });
    if (problem.status >= 500) request.log.error({ err: error }, problem.title);
    return reply.status(problem.status).type('application/problem+json').send(problem);
  });

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?', 1)[0] ?? request.url;
    if (webRoot !== undefined && isSpaRoute(request, path)) {
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

  return app;
}
