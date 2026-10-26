import { readFileSync } from 'node:fs';

import type { FieldError } from '@contatos/contracts';
import { describe, expect, it } from 'vitest';

import { readCsv } from '@/modules/imports/domain/csv-reader';
import { createDuplicateTracker } from '@/modules/imports/domain/duplicate-tracker';
import { validateRow } from '@/modules/imports/domain/row-validator';

import { generateLargeCsv } from '../fixtures/large-csv';

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url));

interface Summary {
  valid: { line: number; name: string; mobile: string }[];
  rejected: { line: number; errors: Pick<FieldError, 'field' | 'code' | 'firstLine'>[] }[];
}

/** O que o worker fará por linha: validar, depois checar duplicata no arquivo (RN11, RN12). */
async function summarize(
  bytes: Uint8Array,
): Promise<Summary & { encoding: string; delimiter: string }> {
  const document = await readCsv(bytes);
  if (!document.ok) throw new Error(document.reason);
  const duplicates = createDuplicateTracker();
  const summary: Summary = { valid: [], rejected: [] };
  for await (const row of document.rows) {
    const result = validateRow(row);
    const duplicate = result.ok
      ? duplicates.check(result.contact.mobile, row.lineNumber)
      : undefined;
    if (result.ok && !duplicate) {
      summary.valid.push({
        line: row.lineNumber,
        name: result.contact.name,
        mobile: result.contact.mobile,
      });
    } else {
      const errors = result.ok ? [duplicate] : result.errors;
      summary.rejected.push({
        line: row.lineNumber,
        errors: errors.flatMap((error) =>
          error
            ? [
                {
                  field: error.field,
                  code: error.code,
                  ...(error.firstLine && { firstLine: error.firstLine }),
                },
              ]
            : [],
        ),
      });
    }
  }
  return { ...summary, encoding: document.encoding, delimiter: document.delimiter };
}

describe('fixtures de importação (T-UB04, docs/05 "Formato do CSV")', () => {
  it('utf8-virgula.csv: UTF-8, vírgula e campo entre aspas com vírgula', async () => {
    const summary = await summarize(fixture('utf8-virgula.csv'));

    expect(summary).toMatchObject({ encoding: 'utf-8', delimiter: ',', rejected: [] });
    expect(summary.valid).toEqual([
      { line: 2, name: 'Maria Silva', mobile: '+5581999990000' },
      { line: 3, name: 'Souza, João', mobile: '+5581988881111' },
      { line: 4, name: 'Conceição Araújo', mobile: '+5581977772222' },
    ]);
  });

  it('utf8-bom-ponto-e-virgula.csv: BOM descartado, `;`, CRLF e cabeçalho "E-mail"', async () => {
    const summary = await summarize(fixture('utf8-bom-ponto-e-virgula.csv'));

    expect(summary).toMatchObject({ encoding: 'utf-8', delimiter: ';', rejected: [] });
    expect(summary.valid.map(({ line, name }) => [line, name])).toEqual([
      [2, 'Ana Lima'],
      [3, 'André Gonçalves'],
    ]);
  });

  it('win1252-ponto-e-virgula.csv: Excel pt-BR com acentos reais e colunas em outra ordem', async () => {
    const summary = await summarize(fixture('win1252-ponto-e-virgula.csv'));

    expect(summary).toMatchObject({ encoding: 'windows-1252', delimiter: ';', rejected: [] });
    expect(summary.valid.map(({ name }) => name)).toEqual([
      'José Conceição',
      'Sônia Ferreira',
      'Inês Müller',
    ]);
  });

  it('cabecalho-invalido.csv: sem a coluna celular, a importação falha antes das linhas', async () => {
    expect(await readCsv(fixture('cabecalho-invalido.csv'))).toEqual({
      ok: false,
      reason: 'Cabeçalho sem as colunas obrigatórias: celular.',
    });
  });

  it('linhas-invalidas.csv: cada linha com os erros esperados, na numeração do editor', async () => {
    const summary = await summarize(fixture('linhas-invalidas.csv'));

    expect(summary.valid.map(({ line }) => line)).toEqual([2, 10, 12]);
    expect(summary.rejected).toEqual([
      {
        line: 3,
        errors: [
          { field: 'nome', code: 'NAME_TOO_SHORT' },
          { field: 'email', code: 'INVALID_EMAIL' },
          { field: 'celular', code: 'NOT_A_MOBILE_NUMBER' },
        ],
      },
      { line: 5, errors: [{ field: 'nome', code: 'REQUIRED' }] },
      { line: 6, errors: [{ field: 'celular', code: 'NOT_A_MOBILE_NUMBER' }] },
      { line: 7, errors: [{ field: 'telefone', code: 'INVALID_PHONE' }] },
      { line: 8, errors: [{ field: '', code: 'COLUMN_COUNT_MISMATCH' }] },
    ]);
  });

  it('duplicados-no-arquivo.csv: o mesmo celular com máscaras diferentes vira DUPLICATE_IN_FILE', async () => {
    const summary = await summarize(fixture('duplicados-no-arquivo.csv'));

    expect(summary.valid.map(({ line }) => line)).toEqual([2, 3]);
    expect(summary.rejected).toEqual([
      { line: 4, errors: [{ field: 'celular', code: 'DUPLICATE_IN_FILE', firstLine: 2 }] },
      { line: 5, errors: [{ field: 'celular', code: 'DUPLICATE_IN_FILE', firstLine: 2 }] },
    ]);
  });

  it('gerador de 10 mil linhas: lê, valida e numera todas', async () => {
    const summary = await summarize(new TextEncoder().encode(generateLargeCsv(10_000)));

    expect(summary.valid).toHaveLength(9_900);
    expect(summary.rejected).toHaveLength(100);
    expect(summary.rejected.at(-1)).toEqual({
      line: 10_001,
      errors: [{ field: 'email', code: 'INVALID_EMAIL' }],
    });
  });
});
