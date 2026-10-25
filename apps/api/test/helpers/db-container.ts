import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';

import type { Orm } from '@/shared/db/client';
import { runMigrations } from '@/shared/db/migrator';

const POSTGRES_IMAGE = 'postgres:18-alpine';

export const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function startPostgres(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer(POSTGRES_IMAGE).start();
}

export async function startMigratedPostgres(): Promise<StartedPostgreSqlContainer> {
  const container = await startPostgres();
  await runMigrations({ connectionString: container.getConnectionUri(), migrationsFolder });
  return container;
}

export async function truncateAll(orm: Orm): Promise<void> {
  await orm.execute(
    sql`TRUNCATE users, sessions, contacts, imports, import_files, import_errors RESTART IDENTITY CASCADE`,
  );
}
