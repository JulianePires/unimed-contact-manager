import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabase, type Database } from '@/shared/db/client';

import { buildTestApp, type TestApp } from '../helpers/app';
import { startMigratedPostgres } from '../helpers/db-container';

let container: StartedPostgreSqlContainer;
let db: Database;
let app: TestApp;
let containerStopped = false;
const idleClientErrors: Error[] = [];

beforeAll(async () => {
  container = await startMigratedPostgres();
  db = createDatabase(container.getConnectionUri());
  db.onIdleClientError((error) => idleClientErrors.push(error));
  app = await buildTestApp(db);
});

afterAll(async () => {
  await app.close();
  await db.close();
  if (!containerStopped) await container.stop();
});

describe('GET /api/health/ready', () => {
  it('dado o banco acessível, então responde 200', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('dado o banco derrubado, então responde 503 em Problem Details', async () => {
    await container.stop();
    containerStopped = true;

    const response = await app.inject({ method: 'GET', url: '/api/health/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('dado o banco derrubado, então a conexão ociosa perdida é reportada sem derrubar o processo', async () => {
    await expect.poll(() => idleClientErrors.length).toBeGreaterThan(0);
  });
});
