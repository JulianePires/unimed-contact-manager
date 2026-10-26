import { describe, expect, it } from 'vitest';

import { loadEnv } from './env';

const DATABASE_URL = 'postgres://contatos:contatos@localhost:5432/contatos';

describe('loadEnv', () => {
  it('aplica padrões e converte a porta', () => {
    expect(loadEnv({ DATABASE_URL, PORT: '8080' })).toEqual({
      NODE_ENV: 'development',
      HOST: '0.0.0.0',
      PORT: 8080,
      DATABASE_URL,
      LOG_LEVEL: 'info',
      WORKER_MODE: 'standalone',
      MIGRATE_ON_BOOT: false,
      SESSION_COOKIE_NAME: '__Host-sid',
      SESSION_IDLE_MINUTES: 120,
      SESSION_MAX_DAYS: 7,
      IMPORT_MAX_BYTES: 5_242_880,
      IMPORT_ERRORS_RETENTION_DAYS: 30,
    });
  });

  it('mantém as variáveis documentadas informadas', () => {
    expect(
      loadEnv({
        DATABASE_URL,
        WORKER_MODE: 'embedded',
        SESSION_COOKIE_NAME: 'sid',
        SESSION_IDLE_MINUTES: '30',
        IMPORT_MAX_BYTES: '1024',
        WEB_DIST_DIR: '/app/web',
      }),
    ).toMatchObject({
      WORKER_MODE: 'embedded',
      SESSION_COOKIE_NAME: 'sid',
      SESSION_IDLE_MINUTES: 30,
      IMPORT_MAX_BYTES: 1024,
      WEB_DIST_DIR: '/app/web',
    });
  });

  it.each([
    ['sem DATABASE_URL', {}],
    ['DATABASE_URL que não é PostgreSQL', { DATABASE_URL: 'mysql://localhost/db' }],
    ['porta inválida', { DATABASE_URL, PORT: '99999' }],
    ['WORKER_MODE desconhecido', { DATABASE_URL, WORKER_MODE: 'cluster' }],
    ['MIGRATE_ON_BOOT que não é booleano', { DATABASE_URL, MIGRATE_ON_BOOT: 'talvez' }],
  ])('falha rápido %s', (_, source) => {
    expect(() => loadEnv(source)).toThrow('Variáveis de ambiente inválidas');
  });

  it.each([
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
  ])('MIGRATE_ON_BOOT=%s vira %s', (value, expected) => {
    expect(loadEnv({ DATABASE_URL, MIGRATE_ON_BOOT: value }).MIGRATE_ON_BOOT).toBe(expected);
  });
});
