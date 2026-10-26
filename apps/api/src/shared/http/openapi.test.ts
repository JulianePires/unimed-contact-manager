import type { OpenAPIV3_1 } from 'openapi-types';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '@/app';
import { authConfigFromEnv } from '@/modules/auth/routes';
import { loadEnv } from '@/shared/config/env';
import { createDatabase } from '@/shared/db/client';

const env = loadEnv({ DATABASE_URL: 'postgres://localhost:5432/sem-conexao' });
const { orm } = createDatabase(env.DATABASE_URL);

type App = Awaited<ReturnType<typeof buildApp>>;
let app: App | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function build(docs: boolean) {
  app = await buildApp({
    db: { ping: () => Promise.resolve(), orm },
    auth: authConfigFromEnv(env),
    jobQueue: { enqueue: () => Promise.resolve() },
    importMaxBytes: env.IMPORT_MAX_BYTES,
    docs,
  });
  return app;
}

async function specOf(server: App): Promise<OpenAPIV3_1.Document> {
  const response = await server.inject({ method: 'GET', url: '/api/docs/json' });
  expect(response.statusCode).toBe(200);
  return response.json<OpenAPIV3_1.Document>();
}

describe('documentação da API (docs/05, ADR-007)', () => {
  it('dado docs habilitado, então serve a interface em /api/docs', async () => {
    const server = await build(true);

    const response = await server.inject({ method: 'GET', url: '/api/docs/' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
  });

  it('dado produção (docs desabilitado), então /api/docs não existe', async () => {
    const server = await build(false);

    expect((await server.inject({ method: 'GET', url: '/api/docs/json' })).statusCode).toBe(404);
  });

  it('gera OpenAPI 3.1 com todas as rotas da API', async () => {
    const spec = await specOf(await build(true));

    expect(spec.openapi).toBe('3.1.0');
    expect(Object.keys(spec.paths ?? {}).sort()).toEqual([
      '/api/health/live',
      '/api/health/ready',
      '/api/v1/auth/login',
      '/api/v1/auth/logout',
      '/api/v1/auth/logout-all',
      '/api/v1/auth/me',
      '/api/v1/auth/register',
      '/api/v1/contacts',
      '/api/v1/contacts/{id}',
      '/api/v1/contacts/{id}/deactivate',
      '/api/v1/contacts/{id}/favorite',
      '/api/v1/contacts/{id}/reactivate',
      '/api/v1/imports',
      '/api/v1/imports/template.csv',
      '/api/v1/imports/{id}',
      '/api/v1/imports/{id}/errors',
      '/api/v1/imports/{id}/errors.csv',
    ]);
  });

  it('documenta corpo, erros em Problem Details e o cookie de sessão', async () => {
    const spec = await specOf(await build(true));
    const create = spec.paths?.['/api/v1/contacts']?.post;

    expect(create?.requestBody).toBeDefined();
    expect(Object.keys(create?.responses ?? {})).toEqual(
      expect.arrayContaining(['201', '401', '409', '422']),
    );
    expect(spec.components?.securitySchemes).toEqual({
      sessionCookie: { type: 'apiKey', in: 'cookie', name: '__Host-sid' },
    });
    expect(spec.paths?.['/api/v1/auth/login']?.post?.security).toEqual([]);
  });

  it('documenta o upload como multipart com o campo file', async () => {
    const spec = await specOf(await build(true));
    const upload = spec.paths?.['/api/v1/imports']?.post?.requestBody;

    expect(upload).toMatchObject({
      content: {
        'multipart/form-data': {
          schema: {
            required: ['file'],
            properties: { file: { type: 'string', format: 'binary' } },
          },
        },
      },
    });
  });
});

describe('validação nativa e autenticação (RF04)', () => {
  it('dado corpo inválido sem sessão, então 401 (a sessão é verificada antes da validação)', async () => {
    const server = await build(false);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      headers: { 'x-requested-with': 'fetch' },
      payload: { name: 1 },
    });

    expect(response.statusCode).toBe(401);
  });
});
