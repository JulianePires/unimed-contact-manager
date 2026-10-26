import { randomUUID } from 'node:crypto';

import fastifyCookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyRequest, type FastifyServerOptions } from 'fastify';
import { serializerCompiler } from 'fastify-type-provider-zod';

import { authModule } from '@/modules/auth';
import { requireCsrfHeader } from '@/modules/auth/hooks';
import type { AuthConfig } from '@/modules/auth/routes';
import { contactsModule } from '@/modules/contacts';
import { importsModule } from '@/modules/imports';
import type { Database } from '@/shared/db/client';
import { AppError, toProblemDetails } from '@/shared/errors';
import { healthRoutes } from '@/shared/http/health';
import { registerOpenApi } from '@/shared/http/openapi';
import { validatorCompiler } from '@/shared/http/validation';
import type { JobQueue } from '@/shared/queue/job-queue';

export interface AppDeps {
  db: Pick<Database, 'ping' | 'orm'>;
  auth: AuthConfig;
  jobQueue: JobQueue;
  importMaxBytes: number;
  /** OpenAPI em `/api/docs`: só fora de produção (docs/05). */
  docs?: boolean;
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
  auth: authConfig,
  jobQueue,
  importMaxBytes,
  docs = false,
  now = () => new Date(),
  logger = false,
  webRoot,
}: AppDeps) {
  const app = Fastify({ logger, genReqId: () => randomUUID() });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  if (docs) await registerOpenApi(app);

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

  const auth = authModule({ db: db.orm, config: authConfig, now });
  await app.register(auth.plugin);
  await app.register(contactsModule(db.orm, auth.authenticate));
  await app.register(
    importsModule({
      db: db.orm,
      jobQueue,
      maxFileBytes: importMaxBytes,
      authenticate: auth.authenticate,
    }),
  );

  return app;
}
