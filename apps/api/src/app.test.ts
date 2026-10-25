import { healthStatusSchema, problemDetailsSchema } from '@contatos/contracts';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from './app';

type App = Awaited<ReturnType<typeof buildApp>>;

let app: App | undefined;

async function appWith(ping: () => Promise<void>) {
  app = await buildApp({ db: { ping } });
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('health', () => {
  it('live responde ok sem consultar o banco', async () => {
    const server = await appWith(() => Promise.reject(new Error('não deveria consultar')));

    const response = await server.inject({ method: 'GET', url: '/api/health/live' });

    expect(response.statusCode).toBe(200);
    expect(healthStatusSchema.parse(response.json())).toEqual({ status: 'ok' });
  });

  it('ready responde ok quando o banco está acessível', async () => {
    const server = await appWith(() => Promise.resolve());

    const response = await server.inject({ method: 'GET', url: '/api/health/ready' });

    expect(response.statusCode).toBe(200);
  });

  it('ready responde 503 em Problem Details quando o banco falha', async () => {
    const server = await appWith(() => Promise.reject(new Error('ECONNREFUSED')));

    const response = await server.inject({ method: 'GET', url: '/api/health/ready?q=maria' });

    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(problemDetailsSchema.parse(response.json())).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      instance: '/api/health/ready',
    });
  });
});

describe('erros', () => {
  it('rota inexistente responde 404 em Problem Details com requestId', async () => {
    const server = await appWith(() => Promise.resolve());

    const response = await server.inject({ method: 'GET', url: '/api/v1/nada' });

    expect(response.statusCode).toBe(404);
    expect(problemDetailsSchema.parse(response.json())).toMatchObject({
      code: 'NOT_FOUND',
      requestId: expect.any(String),
    });
  });

  it('aplica os headers de segurança do helmet', async () => {
    const server = await appWith(() => Promise.resolve());

    const response = await server.inject({ method: 'GET', url: '/api/health/live' });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
  });
});
