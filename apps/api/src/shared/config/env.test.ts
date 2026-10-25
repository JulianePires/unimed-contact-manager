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
    });
  });

  it.each([
    ['sem DATABASE_URL', {}],
    ['DATABASE_URL que não é PostgreSQL', { DATABASE_URL: 'mysql://localhost/db' }],
    ['porta inválida', { DATABASE_URL, PORT: '99999' }],
  ])('falha rápido %s', (_, source) => {
    expect(() => loadEnv(source)).toThrow('Variáveis de ambiente inválidas');
  });
});
