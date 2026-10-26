// Entrypoint do worker standalone (ADR-003). Os jobs do pg-boss entram com o módulo de importação.
import { pino } from 'pino';

import { loadEnv } from '@/shared/config/env';
import { createDatabase } from '@/shared/db/client';
import { loggerOptions } from '@/shared/logger';

const HEARTBEAT_MS = 30_000;

const env = loadEnv();
const log = pino(loggerOptions(env));
const db = createDatabase(env.DATABASE_URL);
db.onIdleClientError((err) => {
  log.warn({ err }, 'conexão ociosa com o banco perdida');
});

await db.ping();
log.info(
  'worker iniciado sem filas registradas: os consumidores do pg-boss chegam com a importação',
);

const heartbeat = setInterval(() => {
  db.ping().catch((err: unknown) => {
    log.warn({ err }, 'banco indisponível');
  });
}, HEARTBEAT_MS);

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    log.info({ signal }, 'encerrando');
    clearInterval(heartbeat);
    void db.close();
  });
}
