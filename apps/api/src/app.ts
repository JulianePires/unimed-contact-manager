import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, {
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';
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
import { CSP_NONCE_PLACEHOLDER, registerSecurityHeaders } from '@/shared/http/security-headers';
import { validatorCompiler } from '@/shared/http/validation';
import type { JobQueue } from '@/shared/queue/job-queue';

export interface AppDeps {
  db: Pick<Database, 'ping' | 'orm'>;
  auth: AuthConfig;
  jobQueue: JobQueue;
  importMaxBytes: number;
  /** OpenAPI em `/api/docs`: só fora de produção (docs/05). */
  docs?: boolean;
  /** Produção: HSTS e `upgrade-insecure-requests` (HTTPS obrigatório). */
  production?: boolean;
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
  production = false,
  now = () => new Date(),
  logger = false,
  webRoot,
}: AppDeps) {
  const app = Fastify({ logger, genReqId: () => randomUUID() });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  if (docs) await registerOpenApi(app);

  await registerSecurityHeaders(app, { production });
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

  // O index.html é lido uma vez e recebe, a cada resposta, o nonce de estilo da CSP
  const indexHtml =
    webRoot === undefined ? undefined : await readFile(join(webRoot, 'index.html'), 'utf8');
  const sendIndex = (reply: FastifyReply, html: string) =>
    reply
      .type('text/html; charset=utf-8')
      .header('cache-control', 'no-cache')
      .send(html.replaceAll(CSP_NONCE_PLACEHOLDER, reply.cspNonce.style));

  app.setNotFoundHandler((request, reply) => {
    if (indexHtml !== undefined && isSpaRoute(request, pathOf(request.url))) {
      return sendIndex(reply, indexHtml);
    }
    throw new AppError(404, 'NOT_FOUND', 'Recurso não encontrado');
  });

  if (webRoot !== undefined && indexHtml !== undefined) {
    // O index.html só sai com o nonce da resposta, nunca como arquivo estático cru
    app.get('/', { schema: { hide: true } }, (_request, reply) => sendIndex(reply, indexHtml));
    await app.register(fastifyStatic, {
      root: webRoot,
      index: false,
      allowedPath: (pathName) => pathName !== '/index.html',
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
