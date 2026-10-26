// Entrypoint do worker standalone (ADR-003, WORKER_MODE=standalone).
import { pino } from 'pino';

import { loadEnv } from '@/shared/config/env';
import { createDatabase } from '@/shared/db/client';
import { loggerOptions } from '@/shared/logger';
import { startJobWorker } from '@/start-worker';

const env = loadEnv();
const log = pino(loggerOptions(env));
const db = createDatabase(env.DATABASE_URL);
db.onIdleClientError((err) => {
  log.warn({ err }, 'conexão ociosa com o banco perdida');
});

const worker = await startJobWorker(env, db, (err) => {
  log.error({ err }, 'erro na fila');
});
log.info('worker iniciado');

// Graceful shutdown: o processamento termina o lote atual e o pg-boss retoma depois
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    log.info({ signal }, 'encerrando');
    void worker.stop().then(() => db.close());
  });
}
