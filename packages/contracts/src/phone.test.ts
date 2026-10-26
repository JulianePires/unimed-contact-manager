import { describe, expect, it } from 'vitest';

import {
  formatPhone,
  formatPhoneInput,
  normalizeMobile,
  normalizePhone,
  phoneInputDigits,
  phoneInputValue,
} from './phone';

describe('normalizeMobile (RN02, ADR-001)', () => {
  it.each([
    ['máscara com DDD', '(81) 99999-0000'],
    ['+55 com espaços', '+55 81 99999-0000'],
    ['E.164', '+5581999990000'],
    ['só dígitos com DDD', '81999990000'],
    ['55 sem +', '55 81 99999 0000'],
    ['prefixo nacional 0', '081 99999-0000'],
    ['espaços nas pontas', '  (81) 99999-0000  '],
  ])('dado celular com %s, então normaliza para E.164', (_, input) => {
    expect(normalizeMobile(input)).toEqual({ ok: true, e164: '+5581999990000' });
  });

  it.each([
    ['sem DDD', '99999-0000'],
    ['com dígito faltando', '(81) 9999-000'],
    ['celular antigo de 8 dígitos', '(81) 9999-0000'],
    ['texto', 'celular'],
    ['vazio', ''],
  ])('dado número %s, então é INVALID_PHONE', (_, input) => {
    expect(normalizeMobile(input)).toEqual({ ok: false, code: 'INVALID_PHONE' });
  });

  it.each([
    ['fixo com máscara', '(81) 3333-0000'],
    ['fixo com +55', '+55 11 2345-6789'],
  ])('dado telefone %s no campo celular, então é NOT_A_MOBILE_NUMBER', (_, input) => {
    expect(normalizeMobile(input)).toEqual({ ok: false, code: 'NOT_A_MOBILE_NUMBER' });
  });

  it('dado número estrangeiro sem distinção fixo/móvel, então aceita', () => {
    expect(normalizeMobile('+1 650 253 0000')).toEqual({ ok: true, e164: '+16502530000' });
  });
});

describe('normalizePhone', () => {
  it.each([
    ['(81) 3333-0000', { e164: '+558133330000', kind: 'fixed' }],
    ['(81) 99999-0000', { e164: '+5581999990000', kind: 'mobile' }],
    ['+1 650 253 0000', { e164: '+16502530000', kind: 'fixed-or-mobile' }],
    ['0800 123 4567', { e164: '+558001234567', kind: 'other' }],
  ])('classifica %s', (input, expected) => {
    expect(normalizePhone(input)).toEqual(expected);
  });

  it('dado número inválido, então devolve null', () => {
    expect(normalizePhone('3333-0000')).toBeNull();
  });
});

describe('formatPhone', () => {
  it.each([
    ['+5581999990000', '(81) 99999-0000'],
    ['+558133330000', '(81) 3333-0000'],
    ['+16502530000', '+1 650 253 0000'],
    ['não é telefone', 'não é telefone'],
  ])('formata %s para exibição como %s', (e164, expected) => {
    expect(formatPhone(e164)).toBe(expected);
  });
});

describe('campo de telefone', () => {
  it.each([
    ['(81) 99999-0000', '81999990000'],
    ['+55 81 99999-0000', '+5581999990000'],
    ['  +1 415', '+1415'],
    ['abc', ''],
  ])('dado %s digitado, então o valor bruto é %s', (input, expected) => {
    expect(phoneInputDigits(input)).toBe(expected);
  });

  it.each([
    ['', ''],
    ['81', '(81)'],
    ['8199999', '(81) 99999'],
    ['81999990000', '(81) 99999-0000'],
    ['+5581999990000', '+55 81 99999 0000'],
  ])('dado %s, então exibe %s enquanto se digita', (raw, expected) => {
    expect(formatPhoneInput(raw)).toBe(expected);
  });

  it.each([
    ['+5581999990000', '81999990000'],
    ['+14155552671', '+14155552671'],
    [null, ''],
  ])('dado %s salvo, então o campo de edição começa com %s', (e164, expected) => {
    expect(phoneInputValue(e164)).toBe(expected);
  });
});
