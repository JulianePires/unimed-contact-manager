// Dados de avaliação: `pnpm db:seed` (rodar após `pnpm db:migrate`); pode ser repetido
import { pino } from 'pino';

import { seedDemo } from '@/demo-seed';
import { loadEnv } from '@/shared/config/env';
import { createDatabase } from '@/shared/db/client';
import { loggerOptions } from '@/shared/logger';

const env = loadEnv();
const log = pino(loggerOptions(env));
const db = createDatabase(env.DATABASE_URL);
try {
  log.info(await seedDemo(db.orm), 'seed concluído');
} finally {
  await db.close();
}
