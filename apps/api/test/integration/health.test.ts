import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';
import { createDatabase, type Database } from '../../src/shared/db/client';

// PostgreSQL real (ADR-010): mesma major do Render (ADR-011)
let container: StartedPostgreSqlContainer;
let db: Database;
let app: Awaited<ReturnType<typeof buildApp>>;
let containerStopped = false;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:18-alpine').start();
  db = createDatabase(container.getConnectionUri());
  app = await buildApp({ db });
});

afterAll(async () => {
  await app.close();
  await db.close();
  if (!containerStopped) await container.stop();
});

describe('GET /api/health/ready', () => {
  it('responde ok com o banco acessível', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('responde 503 quando o banco para', async () => {
    await container.stop();
    containerStopped = true;

    const response = await app.inject({ method: 'GET', url: '/api/health/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });
});
