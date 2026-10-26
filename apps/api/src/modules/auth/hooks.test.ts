import fastifyCookie from '@fastify/cookie';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { createAuthenticate, requireCsrfHeader } from './hooks';
import type { ActiveSession, SessionsRepository } from './repositories/sessions';

const cookie = { name: 'sid', secure: true, maxAgeSeconds: 60 };
const policy = { idleMinutes: 120, maxDays: 7 };
const createdAt = new Date('2026-10-26T12:00:00.000Z');
const user = { id: 'user-1', name: 'Maria', email: 'maria@exemplo.com' };

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function sessionsWith(session: ActiveSession | undefined) {
  const touches: Date[] = [];
  const repository: SessionsRepository = {
    create: () => Promise.resolve('token'),
    findActive: (token) => Promise.resolve(token === 'valido' ? session : undefined),
    touch: (_, { expiresAt }) => {
      touches.push(expiresAt);
      return Promise.resolve();
    },
    delete: () => Promise.resolve(),
    deleteAllOfUser: () => Promise.resolve(),
  };
  return { repository, touches };
}

async function appWith(sessions: SessionsRepository, now: Date) {
  const server = Fastify();
  app = server;
  await server.register(fastifyCookie);
  server.decorateRequest('user', null);
  server.addHook('onRequest', requireCsrfHeader);
  const authenticate = createAuthenticate({ sessions, policy, cookie, now: () => now });
  server.get('/privado', { preHandler: authenticate }, (request) => request.user);
  server.post('/mutacao', () => ({ ok: true }));
  return server;
}

const session = (lastSeenAt: Date): ActiveSession => ({
  idHash: Buffer.from('hash'),
  createdAt,
  lastSeenAt,
  user,
});

describe('requireCsrfHeader (ADR-006)', () => {
  it.each([
    ['POST sem header', 'POST', {}, 403],
    ['POST com X-Requested-With: fetch', 'POST', { 'x-requested-with': 'fetch' }, 200],
    ['GET sem header', 'GET', {}, 401],
  ] as const)('%s → %i', async (_, method, headers, status) => {
    const server = await appWith(sessionsWith(undefined).repository, createdAt);

    const response = await server.inject({
      method,
      url: method === 'GET' ? '/privado' : '/mutacao',
      headers,
    });

    expect(response.statusCode).toBe(status);
  });
});

describe('authenticate', () => {
  it('dado sessão válida, então decora request.user', async () => {
    const server = await appWith(sessionsWith(session(createdAt)).repository, createdAt);

    const response = await server.inject({ url: '/privado', cookies: { sid: 'valido' } });

    expect(response.json()).toEqual(user);
  });

  it('dado cookie inválido, então responde 401 e limpa o cookie', async () => {
    const server = await appWith(sessionsWith(undefined).repository, createdAt);

    const response = await server.inject({ url: '/privado', cookies: { sid: 'invalido' } });

    expect(response.statusCode).toBe(401);
    expect(String(response.headers['set-cookie'])).toMatch(/^sid=;/);
  });

  it('dado acesso há menos de 1 min, então não renova a sessão', async () => {
    const sessions = sessionsWith(session(createdAt));
    const server = await appWith(sessions.repository, new Date(createdAt.getTime() + 59_000));

    await server.inject({ url: '/privado', cookies: { sid: 'valido' } });

    expect(sessions.touches).toEqual([]);
  });

  it('dado acesso após 1 min, então renova a expiração a partir de agora', async () => {
    const sessions = sessionsWith(session(createdAt));
    const server = await appWith(sessions.repository, new Date('2026-10-26T12:30:00.000Z'));

    await server.inject({ url: '/privado', cookies: { sid: 'valido' } });

    expect(sessions.touches).toEqual([new Date('2026-10-26T14:30:00.000Z')]);
  });
});
