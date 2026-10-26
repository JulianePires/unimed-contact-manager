import { describe, expect, it } from 'vitest';

import { checkPasswordPolicy } from './password-policy';

describe('checkPasswordPolicy (docs/05 §5.3)', () => {
  it.each([
    ['12 caracteres', 'a'.repeat(12)],
    ['128 caracteres', 'a'.repeat(128)],
  ])('dado senha com %s, então aceita', (_, password) => {
    expect(checkPasswordPolicy(password)).toEqual([]);
  });

  it.each([
    ['11 caracteres', 'a'.repeat(11), 'PASSWORD_TOO_SHORT'],
    ['129 caracteres', 'a'.repeat(129), 'PASSWORD_TOO_LONG'],
    ['vazia', '', 'REQUIRED'],
  ])('dado senha com %s, então rejeita com %s no campo password', (_, password, code) => {
    expect(checkPasswordPolicy(password)).toEqual([
      expect.objectContaining({ field: 'password', code }),
    ]);
  });
});
