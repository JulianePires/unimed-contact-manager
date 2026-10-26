// Exporta o OpenAPI para docs/openapi.json (docs/05). Com --check, só compara: o CI falha se o
// arquivo versionado não corresponder às rotas. Uso: pnpm openapi:export | pnpm openapi:check
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { buildApp } from '@/app';
import { authConfigFromEnv } from '@/modules/auth/routes';
import { loadEnv } from '@/shared/config/env';
import { createDatabase } from '@/shared/db/client';

const target = fileURLToPath(new URL('../../../docs/openapi.json', import.meta.url));
const check = process.argv.includes('--check');

// Nenhuma rota é chamada: o banco só é declarado, sem conexão
const env = loadEnv({ DATABASE_URL: 'postgres://localhost:5432/openapi' });
const db = createDatabase(env.DATABASE_URL);
const app = await buildApp({
  db,
  auth: authConfigFromEnv(env),
  jobQueue: { enqueue: () => Promise.reject(new Error('Fila indisponível na exportação')) },
  importMaxBytes: env.IMPORT_MAX_BYTES,
  docs: true,
});
await app.ready();
const spec = `${JSON.stringify(app.swagger(), null, 2)}\n`;
await app.close();
await db.close();

if (!check) {
  writeFileSync(target, spec);
  process.stdout.write(`OpenAPI exportado para ${target}\n`);
} else if (readFileSync(target, 'utf8') !== spec) {
  process.stderr.write('docs/openapi.json está desatualizado: rode pnpm openapi:export\n');
  process.exitCode = 1;
}
