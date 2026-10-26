import { describe, expect, it } from 'vitest';

import {
  contactSchema,
  createContactInputSchema,
  listContactsQuerySchema,
  updateContactInputSchema,
} from './contacts';
import { toFieldErrors } from './errors';

const valid = {
  name: 'Maria Silva',
  email: 'maria@empresa.com',
  mobile: '(81) 99999-0000',
  phone: '81 3333-0000',
};

function fieldErrorsOf(input: unknown) {
  const result = createContactInputSchema.safeParse(input);
  if (result.success) throw new Error('esperava falha de validação');
  return toFieldErrors(result.error);
}

describe('createContactInputSchema (RN01, RN02)', () => {
  it('dado dados válidos, então normaliza nome, e-mail e telefones', () => {
    expect(
      createContactInputSchema.parse({
        ...valid,
        name: '  Maria Silva ',
        email: ' maria@empresa.com',
      }),
    ).toEqual({
      name: 'Maria Silva',
      email: 'maria@empresa.com',
      mobile: '+5581999990000',
      phone: '+558133330000',
    });
  });

  it.each([
    ['ausente', undefined],
    ['nulo', null],
    ['vazio', ''],
  ])('dado telefone %s, então fica sem telefone', (_, phone) => {
    expect(createContactInputSchema.parse({ ...valid, phone }).phone).toBeNull();
  });

  it.each([
    ['2 caracteres', 'Al'],
    ['120 caracteres', 'a'.repeat(120)],
  ])('dado nome com %s, então aceita (limite)', (_, name) => {
    expect(createContactInputSchema.safeParse({ ...valid, name }).success).toBe(true);
  });

  it.each([
    ['1 caractere', 'A', 'NAME_TOO_SHORT'],
    ['121 caracteres', 'a'.repeat(121), 'NAME_TOO_LONG'],
    ['só espaços', '   ', 'REQUIRED'],
  ])('dado nome com %s, então rejeita com %s', (_, name, code) => {
    expect(fieldErrorsOf({ ...valid, name })).toEqual([
      expect.objectContaining({ field: 'name', code }),
    ]);
  });

  it('dado e-mail com 254 caracteres, então aceita (limite)', () => {
    const email = `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(61)}`;
    expect(email).toHaveLength(254);

    expect(createContactInputSchema.safeParse({ ...valid, email }).success).toBe(true);
  });

  it.each([
    ['sem domínio', 'joao@', 'INVALID_EMAIL'],
    [
      'com 255 caracteres',
      `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(62)}`,
      'INVALID_EMAIL',
    ],
    ['vazio', ' ', 'REQUIRED'],
  ])('dado e-mail %s, então rejeita com %s', (_, email, code) => {
    expect(fieldErrorsOf({ ...valid, email })).toEqual([
      expect.objectContaining({ field: 'email', code }),
    ]);
  });

  it('dado fixo no campo celular, então rejeita com NOT_A_MOBILE_NUMBER e a mensagem da doc', () => {
    expect(fieldErrorsOf({ ...valid, mobile: '(81) 3333-0000' })).toEqual([
      {
        field: 'mobile',
        code: 'NOT_A_MOBILE_NUMBER',
        message: 'Informe um número de celular válido.',
      },
    ]);
  });

  it('dado celular e telefone inválidos, então rejeita ambos com INVALID_PHONE', () => {
    expect(fieldErrorsOf({ ...valid, mobile: '99999-0000', phone: '3333' })).toEqual([
      expect.objectContaining({ field: 'mobile', code: 'INVALID_PHONE' }),
      expect.objectContaining({ field: 'phone', code: 'INVALID_PHONE' }),
    ]);
  });

  it('dado celular vazio, então rejeita com REQUIRED', () => {
    expect(fieldErrorsOf({ ...valid, mobile: ' ' })).toEqual([
      expect.objectContaining({ field: 'mobile', code: 'REQUIRED' }),
    ]);
  });

  it('dado corpo sem campos obrigatórios, então aponta REQUIRED em cada um', () => {
    expect(fieldErrorsOf({}).map(({ field, code }) => ({ field, code }))).toEqual([
      { field: 'name', code: 'REQUIRED' },
      { field: 'email', code: 'REQUIRED' },
      { field: 'mobile', code: 'REQUIRED' },
    ]);
  });
});

describe('updateContactInputSchema (PATCH)', () => {
  it('dado só o nome, então aceita a edição parcial', () => {
    expect(updateContactInputSchema.parse({ name: 'Maria' })).toEqual({ name: 'Maria' });
  });

  it('dado phone: null, então mantém null para remover o telefone', () => {
    expect(updateContactInputSchema.parse({ phone: null })).toEqual({ phone: null });
  });

  it.each([
    ['status', { status: 'inactive' }],
    ['favorito', { isFavorite: true }],
  ])('dado %s no corpo, então rejeita com UNKNOWN_FIELD', (_, input) => {
    const result = updateContactInputSchema.safeParse({ name: 'Maria', ...input });

    expect(result.success).toBe(false);
    expect(result.error && toFieldErrors(result.error)).toEqual([
      expect.objectContaining({ field: Object.keys(input)[0], code: 'UNKNOWN_FIELD' }),
    ]);
  });

  it('dado corpo vazio, então rejeita com REQUIRED', () => {
    const result = updateContactInputSchema.safeParse({});

    expect(result.error && toFieldErrors(result.error)).toEqual([
      { field: '', code: 'REQUIRED', message: 'Informe ao menos um campo para alterar.' },
    ]);
  });
});

describe('listContactsQuerySchema (docs/05 §5.4)', () => {
  it('dado query vazia, então aplica os padrões', () => {
    expect(listContactsQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      status: 'active',
      sort: 'name',
    });
  });

  it('dado valores de query string, então converte os tipos', () => {
    expect(
      listContactsQuerySchema.parse({
        page: '3',
        pageSize: '100',
        status: 'all',
        favorite: 'true',
        sort: '-createdAt',
        q: ' joão ',
      }),
    ).toEqual({
      page: 3,
      pageSize: 100,
      status: 'all',
      favorite: true,
      sort: '-createdAt',
      q: 'joão',
    });
  });

  it('dado termo com menos de 2 caracteres, então ignora a busca (ADR-005)', () => {
    expect(listContactsQuerySchema.parse({ q: ' a ' }).q).toBeUndefined();
  });

  it.each([
    ['page 0', { page: '0' }],
    ['pageSize acima de 100', { pageSize: '101' }],
    ['pageSize 0', { pageSize: '0' }],
    ['page não numérica', { page: 'x' }],
    ['status desconhecido', { status: 'deleted' }],
    ['favorite não booleano', { favorite: 'sim' }],
    ['ordenação desconhecida', { sort: 'email' }],
    ['termo com mais de 100 caracteres', { q: 'a'.repeat(101) }],
  ])('dado %s, então rejeita', (_, query) => {
    expect(listContactsQuerySchema.safeParse(query).success).toBe(false);
  });
});

describe('contactSchema', () => {
  it('aceita o exemplo de docs/05 §5.4', () => {
    const contact = {
      id: '0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e',
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
    };

    expect(contactSchema.parse(contact)).toEqual(contact);
  });
});
