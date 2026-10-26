import { describe, expect, it } from 'vitest';

import { loginInputSchema, registerInputSchema, userSchema } from './auth';
import { toFieldErrors } from './errors';

const registration = { name: 'Maria Silva', email: 'maria@empresa.com', password: 'a'.repeat(12) };

function codesOf(result: ReturnType<typeof registerInputSchema.safeParse>) {
  return result.error
    ? toFieldErrors(result.error).map(({ field, code }) => ({ field, code }))
    : [];
}

describe('registerInputSchema (docs/05 §5.3)', () => {
  it.each([
    ['12 caracteres', 'a'.repeat(12)],
    ['128 caracteres', 'a'.repeat(128)],
    ['12 emojis (conta grafemas)', '🔒'.repeat(12)],
  ])('dado senha com %s, então aceita', (_, password) => {
    expect(registerInputSchema.safeParse({ ...registration, password }).success).toBe(true);
  });

  it.each([
    ['11 caracteres', 'a'.repeat(11), 'PASSWORD_TOO_SHORT'],
    ['129 caracteres', 'a'.repeat(129), 'PASSWORD_TOO_LONG'],
    ['vazia', '', 'REQUIRED'],
  ])('dado senha com %s, então rejeita com %s', (_, password, code) => {
    expect(codesOf(registerInputSchema.safeParse({ ...registration, password }))).toEqual([
      { field: 'password', code },
    ]);
  });

  it('dado nome e e-mail inválidos, então aplica as mesmas regras do contato', () => {
    expect(
      codesOf(registerInputSchema.safeParse({ ...registration, name: 'A', email: 'maria@' })),
    ).toEqual([
      { field: 'name', code: 'NAME_TOO_SHORT' },
      { field: 'email', code: 'INVALID_EMAIL' },
    ]);
  });

  it('dado campo extra, então rejeita', () => {
    expect(registerInputSchema.safeParse({ ...registration, role: 'admin' }).success).toBe(false);
  });
});

describe('loginInputSchema', () => {
  it('dado senha curta, então aceita (a política vale só no cadastro)', () => {
    expect(
      loginInputSchema.safeParse({ email: 'maria@empresa.com', password: 'curta' }).success,
    ).toBe(true);
  });

  it.each([
    ['vazia', '', 'REQUIRED'],
    ['acima de 128 caracteres', 'a'.repeat(129), 'PASSWORD_TOO_LONG'],
  ])('dado senha %s, então rejeita com %s', (_, password, code) => {
    const result = loginInputSchema.safeParse({ email: 'maria@empresa.com', password });

    expect(result.error && toFieldErrors(result.error)).toEqual([
      expect.objectContaining({ field: 'password', code }),
    ]);
  });
});

describe('userSchema', () => {
  it('expõe só id, nome e e-mail', () => {
    const user = {
      id: '0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e',
      name: 'Maria',
      email: 'maria@empresa.com',
      passwordHash: 'x',
    };

    expect(userSchema.parse(user)).toEqual({ id: user.id, name: user.name, email: user.email });
  });
});
