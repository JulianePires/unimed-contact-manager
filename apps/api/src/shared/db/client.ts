import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

/**
 * Health check com prazo: um banco que aceita a conexão mas não responde não prende o `ready`.
 * O `pg` aceita `query_timeout` por consulta, mas o `@types/pg` só o declara na configuração do pool.
 */
const PING: pg.QueryConfig & { query_timeout: number } = { text: 'select 1', query_timeout: 2_000 };

/** Conexão com o PostgreSQL: cliente Drizzle, verificação de saúde e encerramento. */
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5_000 });
  const orm = drizzle(pool);
  return {
    orm,
    ping: async () => {
      await pool.query(PING);
    },
    close: () => pool.end(),
  };
}

export type Database = ReturnType<typeof createDatabase>;
