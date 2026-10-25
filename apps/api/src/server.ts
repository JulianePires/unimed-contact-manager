// Entrypoint HTTP da API (ADR-007, ADR-010).
import { buildApp } from './app';
import { loadEnv } from './shared/config/env';
import { createDatabase } from './shared/db/client';
import { loggerOptions } from './shared/logger';

const env = loadEnv();
const db = createDatabase(env.DATABASE_URL);
const app = await buildApp({ db, logger: loggerOptions(env) });
app.addHook('onClose', () => db.close());

// Graceful shutdown: para de aceitar conexões (503 durante o fechamento) e conclui as em curso
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    app.log.info({ signal }, 'encerrando');
    void app.close();
  });
}

await app.listen({ host: env.HOST, port: env.PORT });
