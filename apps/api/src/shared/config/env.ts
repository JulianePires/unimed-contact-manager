import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  WORKER_MODE: z.enum(['standalone', 'embedded']).default('standalone'),
  MIGRATE_ON_BOOT: z.stringbool().default(false),
  SESSION_COOKIE_NAME: z.string().min(1).default('__Host-sid'),
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(120),
  SESSION_MAX_DAYS: z.coerce.number().int().positive().default(7),
  IMPORT_MAX_BYTES: z.coerce.number().int().positive().default(5_242_880),
  IMPORT_ERRORS_RETENTION_DAYS: z.coerce.number().int().positive().default(30),
  WEB_DIST_DIR: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
