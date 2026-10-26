import { describe, expect, it } from 'vitest';

import { loggerOptions, redactSearchParams } from './logger';

describe('redactSearchParams', () => {
  it('oculta o termo de busca q (ADR-009)', () => {
    expect(redactSearchParams('/api/v1/contacts?q=maria&page=2')).toBe(
      '/api/v1/contacts?q=%5BREDACTED%5D&page=2',
    );
  });

  it.each(['/api/v1/contacts', '/api/v1/contacts?page=2'])('mantém %s como está', (url) => {
    expect(redactSearchParams(url)).toBe(url);
  });
});

describe('loggerOptions', () => {
  it('usa o nível configurado e redige cookies e autorização', () => {
    expect(loggerOptions({ LOG_LEVEL: 'warn' })).toMatchObject({
      level: 'warn',
      redact: {
        paths: expect.arrayContaining(['req.headers.cookie', 'req.headers.authorization']),
      },
    });
  });

  it('serializa a requisição só com método e URL, sem o termo de busca', () => {
    const serialize = loggerOptions({ LOG_LEVEL: 'info' }).serializers?.['req'];

    expect(serialize?.({ method: 'GET', url: '/api/v1/contacts?q=maria', headers: {} })).toEqual({
      method: 'GET',
      url: '/api/v1/contacts?q=%5BREDACTED%5D',
    });
  });
});
