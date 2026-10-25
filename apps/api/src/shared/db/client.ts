import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema';

/**
 * Health check com prazo: um banco que aceita a conexão mas não responde não prende o `ready`.
 * O `pg` aceita `query_timeout` por consulta, mas o `@types/pg` só o declara na configuração do pool.
 */
const PING: pg.QueryConfig & { query_timeout: number } = { text: 'select 1', query_timeout: 2_000 };

/** Conexão com o PostgreSQL: cliente Drizzle, verificação de saúde e encerramento. */
export function createDatabase(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5_000 });
  // O pool descarta o cliente ocioso que perdeu a conexão; sem listener, o evento derrubaria o processo
  pool.on('error', () => undefined);
  const orm = drizzle(pool, { schema });
  return {
    orm,
    ping: async () => {
      await pool.query(PING);
    },
    onIdleClientError: (listener: (error: Error) => void) => {
      pool.on('error', listener);
    },
    close: () => pool.end(),
  };
}

export type Database = ReturnType<typeof createDatabase>;
export type Orm = Database['orm'];
