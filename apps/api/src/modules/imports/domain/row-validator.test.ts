import { describe, expect, it } from 'vitest';

import type { CsvRow } from './csv-reader';
import { validateRow } from './row-validator';

const row = (raw: CsvRow['raw'], columnCount = 4): CsvRow => ({
  lineNumber: 2,
  raw,
  columnCount,
  expectedColumnCount: 4,
});

const valid = {
  nome: 'Maria Silva',
  email: 'maria@empresa.com',
  celular: '(81) 99999-0000',
  telefone: '',
};

const codesOf = (raw: CsvRow['raw']) => {
  const result = validateRow(row(raw));
  return result.ok ? [] : result.errors.map(({ field, code }) => ({ field, code }));
};

describe('validateRow (T-UB03, RN01, RN02)', () => {
  it('dada linha válida, então normaliza com as mesmas regras do cadastro', () => {
    expect(
      validateRow(row({ ...valid, nome: '  Maria Silva ', telefone: '81 3333-0000' })),
    ).toEqual({
      ok: true,
      contact: {
        name: 'Maria Silva',
        email: 'maria@empresa.com',
        mobile: '+5581999990000',
        phone: '+558133330000',
      },
    });
  });

  it.each([
    ['vazio', valid],
    ['sem a coluna', { nome: valid.nome, email: valid.email, celular: valid.celular }],
  ])('dado telefone %s, então o contato fica sem telefone', (_, raw) => {
    expect(validateRow(row(raw))).toMatchObject({ ok: true, contact: { phone: null } });
  });

  it.each([
    ['nome vazio', { nome: '' }, [{ field: 'nome', code: 'REQUIRED' }]],
    ['nome curto', { nome: 'A' }, [{ field: 'nome', code: 'NAME_TOO_SHORT' }]],
    ['nome longo', { nome: 'a'.repeat(121) }, [{ field: 'nome', code: 'NAME_TOO_LONG' }]],
    ['e-mail inválido', { email: 'joao@' }, [{ field: 'email', code: 'INVALID_EMAIL' }]],
    ['celular vazio', { celular: '' }, [{ field: 'celular', code: 'REQUIRED' }]],
    ['celular inválido', { celular: '9999' }, [{ field: 'celular', code: 'INVALID_PHONE' }]],
    [
      'fixo no celular',
      { celular: '(81) 3333-0000' },
      [{ field: 'celular', code: 'NOT_A_MOBILE_NUMBER' }],
    ],
    ['telefone inválido', { telefone: '123' }, [{ field: 'telefone', code: 'INVALID_PHONE' }]],
  ])('dado %s, então aponta a coluna do CSV', (_, overrides, errors) => {
    expect(codesOf({ ...valid, ...overrides })).toEqual(errors);
  });

  it('dados vários problemas na mesma linha, então lista todos', () => {
    expect(codesOf({ nome: 'A', email: 'joao@', celular: '8133330000', telefone: '' })).toEqual([
      { field: 'nome', code: 'NAME_TOO_SHORT' },
      { field: 'email', code: 'INVALID_EMAIL' },
      { field: 'celular', code: 'NOT_A_MOBILE_NUMBER' },
    ]);
  });

  it('dado número de colunas diferente do cabeçalho, então só COLUMN_COUNT_MISMATCH', () => {
    expect(validateRow(row({ nome: 'Maria', email: 'maria@empresa.com' }, 2))).toEqual({
      ok: false,
      errors: [
        {
          field: '',
          code: 'COLUMN_COUNT_MISMATCH',
          message: 'A linha tem 2 colunas; o cabeçalho tem 4.',
        },
      ],
    });
  });
});
