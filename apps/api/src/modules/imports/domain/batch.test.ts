import { describe, expect, it } from 'vitest';

import { planBatch, prepareRow } from './batch';
import type { CsvRow } from './csv-reader';
import { createDuplicateTracker } from './duplicate-tracker';

const row = (lineNumber: number, raw: CsvRow['raw']): CsvRow => ({
  lineNumber,
  raw,
  columnCount: 3,
  expectedColumnCount: 3,
});

const maria = { nome: 'Maria', email: 'maria@x.com', celular: '(81) 99999-0000' };

describe('prepareRow (ADR-002, RN12)', () => {
  it('dada linha válida e inédita, então segue para o INSERT normalizada', () => {
    expect(prepareRow(row(2, maria), createDuplicateTracker())).toEqual({
      ok: true,
      lineNumber: 2,
      contact: { name: 'Maria', email: 'maria@x.com', mobile: '+5581999990000', phone: null },
    });
  });

  it('dada linha inválida, então rejeitada com os erros e o conteúdo original', () => {
    const prepared = prepareRow(row(3, { ...maria, email: 'maria@' }), createDuplicateTracker());

    expect(prepared).toMatchObject({
      ok: false,
      lineNumber: 3,
      raw: { email: 'maria@' },
      errors: [expect.objectContaining({ field: 'email', code: 'INVALID_EMAIL' })],
    });
  });

  it('dado o mesmo celular com outra máscara, então a segunda vira DUPLICATE_IN_FILE', () => {
    const duplicates = createDuplicateTracker();
    prepareRow(row(2, maria), duplicates);

    expect(
      prepareRow(row(5, { ...maria, celular: '+55 81 99999 0000' }), duplicates),
    ).toMatchObject({
      ok: false,
      lineNumber: 5,
      errors: [{ code: 'DUPLICATE_IN_FILE', firstLine: 2 }],
    });
  });

  it('linha inválida não ocupa o celular: a próxima válida com ele segue', () => {
    const duplicates = createDuplicateTracker();
    prepareRow(row(2, { ...maria, nome: '' }), duplicates);

    expect(prepareRow(row(3, maria), duplicates).ok).toBe(true);
  });
});

describe('planBatch', () => {
  it('separa contatos a inserir das linhas rejeitadas, na ordem do arquivo', () => {
    const duplicates = createDuplicateTracker();
    const rows = [
      prepareRow(row(2, maria), duplicates),
      prepareRow(row(3, { ...maria, nome: 'A' }), duplicates),
      prepareRow(row(4, { ...maria, celular: '(81) 98888-0000' }), duplicates),
      prepareRow(row(5, maria), duplicates),
    ];

    const plan = planBatch(rows);

    expect(plan.contacts.map(({ mobile }) => mobile)).toEqual(['+5581999990000', '+5581988880000']);
    expect(plan.rejected.map(({ lineNumber }) => lineNumber)).toEqual([3, 5]);
  });
});
