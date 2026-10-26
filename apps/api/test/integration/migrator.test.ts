import { type AddressInfo, createServer } from 'node:net';

import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDatabase, type Database } from '@/shared/db/client';
import { runMigrations } from '@/shared/db/migrator';

import { migrationsFolder, startPostgres } from '../helpers/db-container';

let container: StartedPostgreSqlContainer;
let db: Database;

beforeAll(async () => {
  container = await startPostgres();
  db = createDatabase(container.getConnectionUri());
});

afterAll(async () => {
  await db.close();
  await container.stop();
});

const migrate = () =>
  runMigrations({ connectionString: container.getConnectionUri(), migrationsFolder });

async function appliedMigrations(): Promise<number> {
  const { rows } = await db.orm.execute<{ total: number }>(
    sql`SELECT count(*)::int AS total FROM drizzle.__drizzle_migrations`,
  );
  return rows[0]?.total ?? 0;
}

describe('runMigrations', () => {
  it('dado um banco vazio e instâncias concorrentes, então aplica cada migration uma única vez', async () => {
    await Promise.all([migrate(), migrate(), migrate()]);

    expect(await appliedMigrations()).toBe(1);
  });

  it('dado um banco atualizado, quando roda de novo, então não altera nada', async () => {
    await migrate();

    expect(await appliedMigrations()).toBe(1);
  });

  it('dado um banco que aceita a conexão e não responde, então falha no prazo', async () => {
    const silent = createServer(() => undefined);
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', resolve));
    const { port } = silent.address() as AddressInfo;

    try {
      const started = performance.now();
      const stalled = runMigrations({
        connectionString: `postgres://user:pass@127.0.0.1:${port}/db`,
        migrationsFolder,
        connectionTimeoutMillis: 500,
      });

      await expect(stalled).rejects.toThrow(/timeout/i);
      expect(performance.now() - started).toBeLessThan(5_000);
    } finally {
      silent.close();
    }
  });
});
