import { describe, expect, it } from 'vitest';

import { formatOptionalPhone, phoneDigitsOf, stripPhoneMask } from './phone';
import { contactStatusOf } from './status';

describe('stripPhoneMask e phoneDigitsOf', () => {
  it.each([
    ['(81) 99876-5432', '81998765432'],
    ['+55 81 9.9876.5432', '5581998765432'],
  ])('remove a máscara de %s', (value, digits) => {
    expect(stripPhoneMask(value)).toBe(digits);
    expect(phoneDigitsOf(value)).toBe(digits);
  });

  it.each(['joão', '81 ana', ''])('"%s" não é busca por número', (value) => {
    expect(phoneDigitsOf(value)).toBeUndefined();
  });
});

describe('formatOptionalPhone', () => {
  it('formata para exibição ou mantém nulo', () => {
    expect(formatOptionalPhone('+558133330000')).toBe('(81) 3333-0000');
    expect(formatOptionalPhone(null)).toBeNull();
  });
});

describe('contactStatusOf (ADR-004)', () => {
  it('sem deactivated_at é ativo; com data é inativo', () => {
    expect(contactStatusOf(null)).toBe('active');
    expect(contactStatusOf(new Date('2026-10-25T10:00:00.000Z'))).toBe('inactive');
  });
});
