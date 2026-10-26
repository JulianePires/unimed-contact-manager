import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { healthStatusSchema, problemDetailsSchema } from '@contatos/contracts';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '@/app';
import { authConfigFromEnv } from '@/modules/auth/routes';
import { loadEnv } from '@/shared/config/env';
import { createDatabase } from '@/shared/db/client';

const env = loadEnv({ DATABASE_URL: 'postgres://localhost:5432/sem-conexao' });
const { orm } = createDatabase(env.DATABASE_URL);

function build(ping: () => Promise<void>, webRoot?: string) {
  return buildApp({ db: { ping, orm }, auth: authConfigFromEnv(env), webRoot });
}

type App = Awaited<ReturnType<typeof buildApp>>;

let app: App | undefined;

async function appWith(ping: () => Promise<void>) {
  app = await build(ping);
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

  it('rota autenticada sem cookie responde 401 usando o relógio padrão', async () => {
    const server = await appWith(() => Promise.resolve());

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { 'x-requested-with': 'fetch' },
    });

    expect(response.statusCode).toBe(401);
    expect(problemDetailsSchema.parse(response.json())).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('aplica os headers de segurança do helmet', async () => {
    const server = await appWith(() => Promise.resolve());

    const response = await server.inject({ method: 'GET', url: '/api/health/live' });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
  });
});

describe('SPA', () => {
  let webRoot: string;

  beforeAll(async () => {
    webRoot = await mkdtemp(join(tmpdir(), 'web-dist-'));
    await mkdir(join(webRoot, 'assets'));
    await writeFile(join(webRoot, 'index.html'), '<!doctype html><div id="root"></div>');
    await writeFile(join(webRoot, 'assets', 'index-abc123.js'), 'console.log(1)');
  });

  afterAll(() => rm(webRoot, { recursive: true, force: true }));

  async function spa() {
    app = await build(() => Promise.resolve(), webRoot);
    return app;
  }

  it.each(['/', '/contatos/123'])('serve index.html em %s sem cache', async (url) => {
    const server = await spa();

    const response = await server.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.headers['cache-control']).toBe('no-cache');
    expect(response.body).toContain('id="root"');
  });

  it('serve assets com hash em cache longo', async () => {
    const server = await spa();

    const response = await server.inject({ method: 'GET', url: '/assets/index-abc123.js' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it.each([
    ['rota da API inexistente', 'GET', '/api/v1/nada'],
    ['asset inexistente', 'GET', '/assets/nada.js'],
    ['método que não é GET', 'POST', '/contatos'],
  ] as const)('%s continua 404 em Problem Details', async (_, method, url) => {
    const server = await spa();

    const response = await server.inject({
      method,
      url,
      headers: { 'x-requested-with': 'fetch' },
    });

    expect(response.statusCode).toBe(404);
    expect(problemDetailsSchema.parse(response.json())).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('não serve o front quando webRoot não é informado', async () => {
    const server = await appWith(() => Promise.resolve());

    const response = await server.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(404);
  });
});
