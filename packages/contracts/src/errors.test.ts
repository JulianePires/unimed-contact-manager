import { describe, expect, it } from 'vitest';

import { problemDetailsSchema, problemType } from './index';

describe('problemType', () => {
  it('gera a URI em kebab-case a partir do código', () => {
    expect(problemType('MOBILE_ALREADY_EXISTS')).toBe(
      'https://contatos.app/problems/mobile-already-exists',
    );
  });
});

describe('problemDetailsSchema', () => {
  const base = {
    type: problemType('VALIDATION_ERROR'),
    title: 'Dados inválidos',
    status: 422,
    code: 'VALIDATION_ERROR',
  };

  it('aceita extras e errors[]', () => {
    const problem = problemDetailsSchema.parse({
      ...base,
      contactId: '0192f',
      errors: [{ field: 'email', code: 'INVALID_EMAIL', message: 'Informe um e-mail válido.' }],
    });

    expect(problem['contactId']).toBe('0192f');
    expect(problem.errors).toHaveLength(1);
  });

  it.each([
    ['código desconhecido', { code: 'OOPS' }],
    ['status fora de 4xx/5xx', { status: 200 }],
    ['type que não é URI', { type: 'mobile-already-exists' }],
  ])('rejeita %s', (_, override) => {
    expect(problemDetailsSchema.safeParse({ ...base, ...override }).success).toBe(false);
  });
});
