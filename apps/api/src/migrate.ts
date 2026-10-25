import { fileURLToPath } from 'node:url';

import { loadEnv } from '@/shared/config/env';
import { runMigrations } from '@/shared/db/migrator';

const { DATABASE_URL } = loadEnv();

await runMigrations({
  connectionString: DATABASE_URL,
  migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
});
