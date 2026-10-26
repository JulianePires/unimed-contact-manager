import { describe, expect, it } from 'vitest';

import {
  formatCount,
  formatDate,
  formatDateTime,
  formatPhoneForDisplay,
  pluralize,
} from './format';

describe('formatPhoneForDisplay', () => {
  it('formata celular brasileiro no padrão nacional', () => {
    expect(formatPhoneForDisplay('+5581999990000')).toBe('(81) 99999-0000');
  });

  it('formata número estrangeiro no padrão internacional', () => {
    expect(formatPhoneForDisplay('+14155552671')).toBe('+1 415 555 2671');
  });

  it.each([null, undefined, ''])('mostra travessão para %s', (value) => {
    expect(formatPhoneForDisplay(value)).toBe('—');
  });
});

describe('datas em pt-BR', () => {
  const iso = '2026-10-26T12:30:00.000Z';

  it('formata a data no fuso informado', () => {
    expect(formatDate(iso, 'America/Recife')).toBe('26/10/2026');
  });

  it('formata data e hora no fuso informado', () => {
    expect(formatDateTime(iso, 'America/Recife')).toBe('26/10/2026, 09:30');
  });

  it('respeita a virada do dia no fuso de quem lê', () => {
    expect(formatDate('2026-10-27T01:00:00.000Z', 'America/Recife')).toBe('26/10/2026');
  });
});

describe('contagens', () => {
  it('usa separador de milhar', () => {
    expect(formatCount(1200)).toBe('1.200');
  });

  it.each([
    [0, '0 contatos'],
    [1, '1 contato'],
    [2, '2 contatos'],
    [1500, '1.500 contatos'],
  ])('pluraliza %i', (count, expected) => {
    expect(pluralize(count, 'contato', 'contatos')).toBe(expected);
  });
});
