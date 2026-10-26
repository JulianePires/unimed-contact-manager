import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { problemDetailsSchema, problemType, toFieldErrors } from './index';

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

describe('toFieldErrors', () => {
  function errorsOf(schema: z.ZodType, input: unknown) {
    const result = schema.safeParse(input);
    if (result.success) throw new Error('esperava falha de validação');
    return toFieldErrors(result.error);
  }

  it('dado campo extra num objeto aninhado, então aponta o caminho completo', () => {
    const schema = z.object({ contact: z.strictObject({ name: z.string() }) });

    expect(errorsOf(schema, { contact: { name: 'a', status: 'x' } })).toEqual([
      { field: 'contact.status', code: 'UNKNOWN_FIELD', message: 'Campo não permitido.' },
    ]);
  });

  it('dado tipo errado, então usa REQUIRED; demais falhas nativas viram INVALID_VALUE', () => {
    const schema = z.object({ name: z.string(), age: z.int().min(0, 'Idade inválida.') });

    expect(errorsOf(schema, { age: -1 }).map(({ field, code }) => ({ field, code }))).toEqual([
      { field: 'name', code: 'REQUIRED' },
      { field: 'age', code: 'INVALID_VALUE' },
    ]);
  });

  it('dado issue customizada sem código conhecido, então usa INVALID_VALUE', () => {
    const schema = z.string().refine(() => false, { message: 'x', params: { code: 'OOPS' } });

    expect(errorsOf(schema, 'a')).toEqual([{ field: '', code: 'INVALID_VALUE', message: 'x' }]);
  });
});
