import { importJobs } from '@/modules/imports';
import type { Env } from '@/shared/config/env';
import type { Database } from '@/shared/db/client';
import {
  type PgBossWorker,
  type QueueErrorHandler,
  startPgBossWorker,
} from '@/shared/queue/pg-boss-adapter';

/** Consumidor das filas, igual no worker standalone e no modo embutido da API (ADR-003). */
export function startJobWorker(
  env: Pick<Env, 'DATABASE_URL' | 'IMPORT_ERRORS_RETENTION_DAYS'>,
  db: Pick<Database, 'orm'>,
  onError: QueueErrorHandler,
): Promise<PgBossWorker> {
  return startPgBossWorker(
    env.DATABASE_URL,
    importJobs({
      db: db.orm,
      now: () => new Date(),
      retentionDays: env.IMPORT_ERRORS_RETENTION_DAYS,
    }),
    onError,
  );
}
