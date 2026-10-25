import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

/** Conexão com o PostgreSQL: cliente Drizzle, verificação de saúde e encerramento. */
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5_000 });
  const orm = drizzle(pool);
  return {
    orm,
    ping: async () => {
      await orm.execute(sql`select 1`);
    },
    close: () => pool.end(),
  };
}

export type Database = ReturnType<typeof createDatabase>;
