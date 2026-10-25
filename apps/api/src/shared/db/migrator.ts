import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const MIGRATIONS_LOCK_KEY = 7_242_026;

export interface MigrationOptions {
  connectionString: string;
  migrationsFolder: string;
}

export async function runMigrations({
  connectionString,
  migrationsFolder,
}: MigrationOptions): Promise<void> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATIONS_LOCK_KEY]);
    try {
      await migrate(drizzle(client), { migrationsFolder });
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATIONS_LOCK_KEY]);
    }
  } finally {
    await client.end();
  }
}
