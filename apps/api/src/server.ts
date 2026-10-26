// Entrypoint HTTP da API (ADR-007, ADR-010).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { buildApp } from '@/app';
import { authConfigFromEnv } from '@/modules/auth/routes';
import { defaultWebDistDir, migrationsFolder } from '@/paths';
import { loadEnv } from '@/shared/config/env';
import { createDatabase } from '@/shared/db/client';
import { runMigrations } from '@/shared/db/migrator';
import { loggerOptions } from '@/shared/logger';
import { startPgBossQueue } from '@/shared/queue/pg-boss-adapter';
import { startJobWorker } from '@/start-worker';

const env = loadEnv();
const webRoot = env.WEB_DIST_DIR ?? defaultWebDistDir;
const hasWeb = existsSync(join(webRoot, 'index.html'));
const db = createDatabase(env.DATABASE_URL);
const queue = await startPgBossQueue(env.DATABASE_URL, (err) => {
  app.log.error({ err }, 'erro na fila');
});
const app = await buildApp({
  db,
  auth: authConfigFromEnv(env),
  jobQueue: queue.queue,
  importMaxBytes: env.IMPORT_MAX_BYTES,
  docs: env.NODE_ENV !== 'production',
  logger: loggerOptions(env),
  webRoot: hasWeb ? webRoot : undefined,
});
if (!hasWeb) app.log.warn({ webRoot }, 'build do SPA ausente: servindo somente a API');
db.onIdleClientError((err) => {
  app.log.warn({ err }, 'conexão ociosa com o banco perdida');
});
// Render free: sem Background Worker, a própria API consome as filas (ADR-003, ADR-010)
const worker =
  env.WORKER_MODE === 'embedded'
    ? await startJobWorker(env, db, (err) => {
        app.log.error({ err }, 'erro na fila');
      })
    : undefined;
app.addHook('onClose', async () => {
  await worker?.stop();
  await queue.stop();
  await db.close();
});

// Render free: sem preDeployCommand, as migrations rodam aqui sob advisory lock (ADR-010)
if (env.MIGRATE_ON_BOOT) {
  app.log.info('aplicando migrations');
  await runMigrations({ connectionString: env.DATABASE_URL, migrationsFolder });
}

// Graceful shutdown: para de aceitar conexões (503 durante o fechamento) e conclui as em curso
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'encerrando');
    void app.close();
  });
}

await app.listen({ host: env.HOST, port: env.PORT });
