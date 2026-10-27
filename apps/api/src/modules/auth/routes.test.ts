import fastifyCookie from '@fastify/cookie';
import fastifyRateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type preHandlerAsyncHookHandler } from 'fastify';
import { serializerCompiler } from 'fastify-type-provider-zod';
import { afterEach, describe, expect, it } from 'vitest';

import { loadEnv } from '@/shared/config/env';
import { toProblemDetails } from '@/shared/errors';
import { validatorCompiler } from '@/shared/http/validation';

import type { SessionsRepository } from './repositories/sessions';
import type { UsersRepository } from './repositories/users';
import { authConfigFromEnv, authRoutes } from './routes';

const DATABASE_URL = 'postgres://localhost:5432/contatos';
const config = authConfigFromEnv(loadEnv({ DATABASE_URL, NODE_ENV: 'test' }));

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const users: UsersRepository = {
  insert: () => Promise.resolve(null),
  findByEmail: () => Promise.resolve(undefined),
};

function sessionsSpy() {
  const deleted: string[] = [];
  const repository: SessionsRepository = {
    create: () => Promise.resolve('token'),
    findActive: () => Promise.resolve(undefined),
    touch: () => Promise.resolve(),
    delete: (token) => {
      deleted.push(token);
      return Promise.resolve();
    },
    deleteAllOfUser: () => Promise.resolve(),
  };
  return { repository, deleted };
}

/** `authenticate` que deixa passar sem decorar `request.user`: simula rota mal configurada. */
const passThrough: preHandlerAsyncHookHandler = () => Promise.resolve();

async function appWith(sessions: SessionsRepository) {
  const server = Fastify();
  app = server;
  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);
  await server.register(fastifyCookie);
  await server.register(fastifyRateLimit, { global: false });
  server.decorateRequest('user', null);
  server.setErrorHandler((error, request, reply) => {
    const problem = toProblemDetails(error, { instance: request.url, requestId: request.id });
    return reply.status(problem.status).send(problem);
  });
  await server.register(authRoutes, {
    users,
    sessions,
    ...config,
    authenticate: passThrough,
    now: () => new Date('2026-10-26T12:00:00.000Z'),
  });
  return server;
}

describe('authRoutes sem usuário autenticado no request', () => {
  it.each([
    ['GET', '/me'],
    ['POST', '/logout-all'],
  ] as const)('%s %s responde 401 em vez de falhar', async (method, url) => {
    const server = await appWith(sessionsSpy().repository);

    const response = await server.inject({ method, url });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('logout sem cookie só limpa o cookie, sem apagar sessão', async () => {
    const sessions = sessionsSpy();
    const server = await appWith(sessions.repository);

    const response = await server.inject({ method: 'POST', url: '/logout' });

    expect(response.statusCode).toBe(204);
    expect(sessions.deleted).toEqual([]);
  });
});

describe('validação nativa do corpo (ADR-007)', () => {
  it('dado corpo inválido no login, então 422 antes do limite por conta', async () => {
    const server = await appWith(sessionsSpy().repository);

    const response = await server.inject({ method: 'POST', url: '/login', payload: ['x'] });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('authConfigFromEnv', () => {
  it.each([
    ['development', false],
    ['test', true],
    ['production', true],
  ] as const)('NODE_ENV=%s → cookie Secure=%s', (NODE_ENV, secure) => {
    const { cookie, policy } = authConfigFromEnv(loadEnv({ DATABASE_URL, NODE_ENV }));

    expect(cookie).toEqual({ name: '__Host-sid', secure, maxAgeSeconds: 7 * 24 * 60 * 60 });
    expect(policy).toEqual({ idleMinutes: 120, maxDays: 7 });
  });

  it('SECURE_TRANSPORT=false tira o Secure do cookie (Compose local em HTTP)', () => {
    const { cookie } = authConfigFromEnv(
      loadEnv({ DATABASE_URL, NODE_ENV: 'production', SECURE_TRANSPORT: 'false' }),
    );

    expect(cookie.secure).toBe(false);
  });

  it('limite por IP: 10 por minuto por padrão, ajustável por AUTH_IP_RATE_LIMIT', () => {
    expect(authConfigFromEnv(loadEnv({ DATABASE_URL })).rateLimits.perIp).toEqual({
      max: 10,
      timeWindowMs: 60_000,
    });
    expect(
      authConfigFromEnv(loadEnv({ DATABASE_URL, AUTH_IP_RATE_LIMIT: '500' })).rateLimits.perIp.max,
    ).toBe(500);
  });
});
