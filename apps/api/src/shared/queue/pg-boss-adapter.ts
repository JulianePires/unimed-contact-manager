import { sql } from 'drizzle-orm';
import { fromDrizzle, type Job, PgBoss } from 'pg-boss';

import { JOB_NAMES, JOB_SCHEDULES, type JobHandlers, type JobQueue } from './job-queue';

/** Retentativas com backoff: as linhas são idempotentes, reexecutar é seguro (ADR-002, ADR-003). */
const RETRY = { retryLimit: 3, retryBackoff: true } as const;

/** Tempo máximo esperando o job em andamento no desligamento (o processamento para entre lotes). */
const GRACEFUL_STOP_MS = 30_000;

export type QueueErrorHandler = (error: Error) => void;

export interface PgBossQueue {
  queue: JobQueue;
  stop(): Promise<void>;
}

export interface PgBossWorker {
  stop(): Promise<void>;
}

async function startBoss(
  connectionString: string,
  onError: QueueErrorHandler,
  role: { supervise: boolean; schedule: boolean },
): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString, ...role });
  // EventEmitter sem listener de "error" derruba o processo
  boss.on('error', onError);
  await boss.start();
  for (const name of JOB_NAMES) await boss.createQueue(name);
  return boss;
}

/**
 * Produtor: a API só enfileira, sem supervisão nem agendamento (ficam com o worker). `start`
 * instala/migra o schema do pg-boss, e as filas são criadas de forma idempotente.
 */
export async function startPgBossQueue(
  connectionString: string,
  onError: QueueErrorHandler,
): Promise<PgBossQueue> {
  const boss = await startBoss(connectionString, onError, { supervise: false, schedule: false });
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

/**
 * Consumidor (worker standalone ou embutido na API): supervisão, agendamentos e um handler por
 * fila. No `stop`, o sinal entregue aos handlers é abortado e o pg-boss aguarda o job em curso.
 */
export async function startPgBossWorker(
  connectionString: string,
  handlers: JobHandlers,
  onError: QueueErrorHandler,
): Promise<PgBossWorker> {
  const boss = await startBoss(connectionString, onError, { supervise: true, schedule: true });
  for (const { name, cron } of JOB_SCHEDULES) await boss.schedule(name, cron, {}, RETRY);

  const stopping = new AbortController();
  const run =
    <T>(handler: (payload: T, signal: AbortSignal) => Promise<unknown>) =>
    async (jobs: Job<T>[]) => {
      for (const job of jobs) {
        await handler(job.data, AbortSignal.any([job.signal, stopping.signal]));
      }
    };
  await boss.work('process-import', run(handlers['process-import']));
  await boss.work('purge-retention', run(handlers['purge-retention']));

  return {
    async stop() {
      stopping.abort();
      await boss.stop({ graceful: true, timeout: GRACEFUL_STOP_MS });
    },
  };
}
