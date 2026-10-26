import { pino } from 'pino';
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

  it('oculta cookie, autorização, senha, e-mail e telefones em qualquer objeto logado', () => {
    const lines: string[] = [];
    const log = pino(loggerOptions({ LOG_LEVEL: 'info' }), {
      write: (line: string) => lines.push(line),
    });

    log.info(
      {
        email: 'maria@empresa.com',
        input: { password: 'segredo', mobile: '+5581999990000' },
        contact: { previous: { phone: '+558133330000', email: 'a@b.com' } },
        res: { headers: { 'set-cookie': '__Host-sid=abc' } },
        userId: 'u1',
      },
      'evento',
    );

    const entry = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
    expect(entry).toMatchObject({
      email: '[REDACTED]',
      input: { password: '[REDACTED]', mobile: '[REDACTED]' },
      contact: { previous: { phone: '[REDACTED]', email: '[REDACTED]' } },
      res: { headers: { 'set-cookie': '[REDACTED]' } },
      userId: 'u1',
    });
    expect(lines[0]).not.toMatch(/maria@empresa|segredo|99999|33330000|abc/);
  });

  it('serializa a requisição só com método e URL, sem o termo de busca', () => {
    const serialize = loggerOptions({ LOG_LEVEL: 'info' }).serializers?.['req'];

    expect(serialize?.({ method: 'GET', url: '/api/v1/contacts?q=maria', headers: {} })).toEqual({
      method: 'GET',
      url: '/api/v1/contacts?q=%5BREDACTED%5D',
    });
  });
});
