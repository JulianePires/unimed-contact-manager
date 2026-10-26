import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabase, type Database } from '@/shared/db/client';
import { PERMISSIONS_POLICY } from '@/shared/http/security-headers';

import { buildTestApp, registerUser, type TestApp } from '../helpers/app';
import { startMigratedPostgres } from '../helpers/db-container';

let container: StartedPostgreSqlContainer;
let db: Database;
let webRoot: string;
const apps: TestApp[] = [];

const INDEX_HTML =
  '<!doctype html><html><head><meta name="csp-nonce" content="__CSP_NONCE__" /></head><body><div id="root"></div></body></html>';

beforeAll(async () => {
  container = await startMigratedPostgres();
  db = createDatabase(container.getConnectionUri());
  webRoot = await mkdtemp(join(tmpdir(), 'web-dist-'));
  await writeFile(join(webRoot, 'index.html'), INDEX_HTML);
});

afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
  await db.close();
  await container.stop();
  await rm(webRoot, { recursive: true, force: true });
});

async function appWith(options: { production?: boolean; docs?: boolean } = {}) {
  const app = await buildTestApp(db, { webRoot, ...options });
  apps.push(app);
  return app;
}

/** Diretivas da CSP como mapa `nome → valores`. */
function cspOf(header: unknown): Map<string, string[]> {
  return new Map(
    String(header)
      .split(';')
      .map((directive) => directive.trim().split(/\s+/))
      .filter(([name]) => name)
      .map(([name = '', ...values]) => [name, values]),
  );
}

function expectStrictHeaders(headers: Record<string, unknown>) {
  const csp = cspOf(headers['content-security-policy']);
  expect(String(headers['content-security-policy'])).not.toContain('unsafe-inline');
  expect(String(headers['content-security-policy'])).not.toContain('unsafe-eval');
  expect(csp.get('default-src')).toEqual(["'self'"]);
  expect(csp.get('script-src')?.[0]).toBe("'self'");
  expect(csp.get('style-src')?.[0]).toBe("'self'");
  expect(csp.get('object-src')).toEqual(["'none'"]);
  expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
  expect(csp.get('base-uri')).toEqual(["'self'"]);
  expect(csp.get('form-action')).toEqual(["'self'"]);
  expect(csp.get('require-trusted-types-for')).toEqual(["'script'"]);
  expect(csp.get('trusted-types')).toEqual(['default']);
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['permissions-policy']).toBe(PERMISSIONS_POLICY);
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  expect(headers['x-powered-by']).toBeUndefined();
}

describe('headers de segurança (RNF03, ADR-008)', () => {
  it('o SPA (/) tem CSP estrita com nonce de estilo igual ao do index.html', async () => {
    const app = await appWith();

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expectStrictHeaders(response.headers);
    const styleSrc = cspOf(response.headers['content-security-policy']).get('style-src') ?? [];
    const nonce = /content="([^"]+)"/.exec(response.body)?.[1] ?? '';
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(styleSrc).toContain(`'nonce-${nonce}'`);
    expect(response.body).not.toContain('__CSP_NONCE__');
  });

  it('o nonce muda a cada resposta, inclusive nas rotas do SPA', async () => {
    const app = await appWith();

    const [first, second] = await Promise.all([
      app.inject({ method: 'GET', url: '/' }),
      app.inject({ method: 'GET', url: '/contatos/123' }),
    ]);

    const nonceOf = (body: string) => /content="([^"]+)"/.exec(body)?.[1];
    expect(nonceOf(first.body)).toBeDefined();
    expect(nonceOf(first.body)).not.toBe(nonceOf(second.body));
  });

  it('o index.html não é servido cru, com o marcador do nonce', async () => {
    const app = await appWith();

    const response = await app.inject({ method: 'GET', url: '/index.html' });

    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain('__CSP_NONCE__');
  });

  it.each([
    ['saúde', '/api/health/live', 200],
    ['rota autenticada sem sessão', '/api/v1/contacts', 401],
    ['rota inexistente', '/api/v1/nada', 404],
  ])('a API (%s) leva os mesmos headers', async (_, url, status) => {
    const app = await appWith();

    const response = await app.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(status);
    expectStrictHeaders(response.headers);
  });

  it('a API autenticada leva os mesmos headers', async () => {
    const app = await appWith();
    const { cookie } = await registerUser(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/contacts',
      headers: { cookie },
    });

    expect(response.statusCode).toBe(200);
    expectStrictHeaders(response.headers);
  });

  it('fora de produção, sem HSTS nem upgrade-insecure-requests', async () => {
    const app = await appWith();

    const response = await app.inject({ method: 'GET', url: '/api/health/live' });

    expect(response.headers['strict-transport-security']).toBeUndefined();
    expect(
      cspOf(response.headers['content-security-policy']).has('upgrade-insecure-requests'),
    ).toBe(false);
  });

  it.each(['/', '/api/health/live'])('em produção, %s exige HTTPS (HSTS)', async (url) => {
    const app = await appWith({ production: true });

    const response = await app.inject({ method: 'GET', url });

    expect(response.headers['strict-transport-security']).toBe(
      'max-age=63072000; includeSubDomains',
    );
    expect(
      cspOf(response.headers['content-security-policy']).has('upgrade-insecure-requests'),
    ).toBe(true);
    expectStrictHeaders(response.headers);
  });
});

describe('documentação OpenAPI (RNF20)', () => {
  it('em produção, /api/docs não existe', async () => {
    const app = await appWith({ production: true, docs: false });

    const response = await app.inject({ method: 'GET', url: '/api/docs/json' });

    expect(response.statusCode).toBe(404);
  });

  it('fora de produção, /api/docs serve o OpenAPI e a interface com a CSP própria', async () => {
    const app = await appWith({ docs: true });

    const spec = await app.inject({ method: 'GET', url: '/api/docs/json' });
    const ui = await app.inject({ method: 'GET', url: '/api/docs' });

    expect(spec.statusCode).toBe(200);
    expect(spec.json()).toMatchObject({ openapi: '3.1.0' });
    expect(ui.statusCode).toBe(200);
    const csp = cspOf(ui.headers['content-security-policy']);
    expect(csp.has('require-trusted-types-for')).toBe(false);
    expect(csp.has('upgrade-insecure-requests')).toBe(false);
  });
});
