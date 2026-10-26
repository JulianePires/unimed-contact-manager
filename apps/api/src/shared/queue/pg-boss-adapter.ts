import { sql } from 'drizzle-orm';
import { fromDrizzle, PgBoss } from 'pg-boss';

import { JOB_NAMES, type JobQueue } from './job-queue';

/** Retentativas com backoff: as linhas são idempotentes, reexecutar é seguro (ADR-002, ADR-003). */
const RETRY = { retryLimit: 3, retryBackoff: true } as const;

export interface PgBossQueue {
  queue: JobQueue;
  stop(): Promise<void>;
}

/**
 * Fila sobre o PostgreSQL. A API só enfileira: sem supervisão nem agendamento, que ficam com o
 * worker. `start` instala/migra o schema do pg-boss e as filas são criadas de forma idempotente.
 */
export async function startPgBossQueue(connectionString: string): Promise<PgBossQueue> {
  const boss = new PgBoss({ connectionString, supervise: false, schedule: false });
  await boss.start();
  for (const name of JOB_NAMES) await boss.createQueue(name);

  return {
    queue: {
      async enqueue(tx, name, payload) {
        // fromDrizzle: o INSERT do job usa a transação dos dados (pg-boss 12, "Create jobs in an
        // existing db transaction")
        const id = await boss.send(name, payload, { ...RETRY, db: fromDrizzle(tx, sql) });
        if (id === null) throw new Error(`Job "${name}" não foi criado`);
      },
    },
    stop: () => boss.stop({ graceful: true }),
  };
}
