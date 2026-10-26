import { contactSchema } from '@contatos/contracts';
import { describe, expect, it } from 'vitest';

import { type ContactRecord, contactEtag, parseSearchIntent, toContact } from './contact';

const record: ContactRecord = {
  id: '0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e',
  name: 'Maria Silva',
  email: 'maria@empresa.com',
  mobileE164: '+5581999990000',
  phoneE164: '+558133330000',
  isFavorite: true,
  deactivatedAt: null,
  version: 3,
  createdAt: new Date('2026-10-20T12:00:00.000Z'),
  updatedAt: new Date('2026-10-24T09:30:00.000Z'),
};

describe('toContact (docs/05 §5.4)', () => {
  it('dado contato ativo, então produz o recurso Contact do contrato', () => {
    const contact = toContact(record);

    expect(contactSchema.parse(contact)).toEqual({
      id: record.id,
      name: 'Maria Silva',
      email: 'maria@empresa.com',
      mobile: '+5581999990000',
      mobileFormatted: '(81) 99999-0000',
      phone: '+558133330000',
      phoneFormatted: '(81) 3333-0000',
      isFavorite: true,
      status: 'active',
      deactivatedAt: null,
      version: 3,
      createdAt: '2026-10-20T12:00:00.000Z',
      updatedAt: '2026-10-24T09:30:00.000Z',
    });
  });

  it('dado contato inativo sem telefone, então expõe status, data e telefone nulo', () => {
    const contact = toContact({
      ...record,
      phoneE164: null,
      deactivatedAt: new Date('2026-10-25T10:00:00.000Z'),
    });

    expect(contact).toMatchObject({
      status: 'inactive',
      deactivatedAt: '2026-10-25T10:00:00.000Z',
      phone: null,
      phoneFormatted: null,
    });
  });

  it.each([
    ['sem e-mail', { email: null }],
    ['sem celular', { mobileE164: null }],
  ])('dado contato eliminado (%s), então recusa expô-lo', (_, overrides) => {
    expect(() => toContact({ ...record, ...overrides })).toThrow('Contato eliminado');
  });
});

describe('contactEtag', () => {
  it('deriva o ETag da versão', () => {
    expect(contactEtag(3)).toBe('"v3"');
  });
});

describe('parseSearchIntent (T-UB08, ADR-005)', () => {
  it.each([
    ['99999', { kind: 'mobile', digits: '99999' }],
    ['(81) 9', { kind: 'mobile', digits: '819' }],
    ['+55 81 99876-5432', { kind: 'mobile', digits: '5581998765432' }],
    ['ana@', { kind: 'email', term: 'ana@' }],
    ['@empresa', { kind: 'email', term: '@empresa' }],
    ['joão', { kind: 'name-or-email', term: 'joão' }],
    ['  José Silva  ', { kind: 'name-or-email', term: 'José Silva' }],
    ['ana 81', { kind: 'name-or-email', term: 'ana 81' }],
  ])('"%s" → %o', (term, intent) => {
    expect(parseSearchIntent(term)).toEqual(intent);
  });

  it.each([undefined, '', '  ', 'a', '(8', '-'])('"%s" não dispara busca', (term) => {
    expect(parseSearchIntent(term)).toBeUndefined();
  });
});
