import { describe, expect, it } from 'vitest';

import { type CsvRow, readCsv } from './csv-reader';

const bytes = (text: string) => new TextEncoder().encode(text);

async function rowsOf(text: string): Promise<CsvRow[]> {
  const document = await readCsv(bytes(text));
  if (!document.ok) throw new Error(document.reason);
  const rows: CsvRow[] = [];
  for await (const row of document.rows) rows.push(row);
  return rows;
}

describe('readCsv', () => {
  it('dado CSV válido, então entrega metadados e linhas com as colunas do docs/05', async () => {
    const document = await readCsv(bytes('celular;nome;email\n81999990000;Ana;ana@x.com\n'));

    expect(document).toMatchObject({
      ok: true,
      encoding: 'utf-8',
      delimiter: ';',
      columns: { mobile: 0, name: 1, email: 2 },
    });
    expect(await rowsOf('celular;nome;email\n81999990000;Ana;ana@x.com\n')).toEqual([
      {
        lineNumber: 2,
        raw: { celular: '81999990000', nome: 'Ana', email: 'ana@x.com' },
        columnCount: 3,
        expectedColumnCount: 3,
      },
    ]);
  });

  it('dadas linhas em branco (inclusive só com delimitadores), então as ignora mas mantém a numeração física', async () => {
    const rows = await rowsOf('nome;email;celular\n\nA;a@x;1\n;;\n\nB;b@x;2\n');

    expect(rows.map((row) => [row.lineNumber, row.raw.nome])).toEqual([
      [3, 'A'],
      [6, 'B'],
    ]);
  });

  it('dado campo entre aspas com quebra de linha, então a linha é a de início do registro', async () => {
    const rows = await rowsOf('nome,email,celular\n"Ana\r\nLima",a@x,1\nBia,b@x,2\n');

    expect(rows.map((row) => [row.lineNumber, row.raw.nome])).toEqual([
      [2, 'Ana\r\nLima'],
      [4, 'Bia'],
    ]);
  });

  it('dado número de colunas diferente do cabeçalho, então informa as contagens', async () => {
    const [short, long] = await rowsOf('nome,email,celular\nAna,a@x\nBia,b@x,2,extra\n');

    expect(short).toMatchObject({ raw: { nome: 'Ana', email: 'a@x' }, columnCount: 2 });
    expect(long).toMatchObject({ columnCount: 4, expectedColumnCount: 3 });
  });

  it('dadas linhas em branco antes do cabeçalho, então o cabeçalho é a primeira linha com conteúdo', async () => {
    expect(await rowsOf('\n\nnome,email,celular\nAna,a@x,1\n')).toEqual([
      expect.objectContaining({ lineNumber: 4 }),
    ]);
  });

  it.each([
    ['vazio', ''],
    ['só linhas em branco', '\n\n;;\n'],
  ])('dado arquivo %s, então falha por falta de cabeçalho', async (_, text) => {
    expect(await readCsv(bytes(text))).toEqual({
      ok: false,
      reason: 'Arquivo vazio: falta o cabeçalho.',
    });
  });

  it('dado cabeçalho inválido, então falha antes de ler as linhas (RN14 → FAILED)', async () => {
    expect(await readCsv(bytes('nome;telefone\nAna;81\n'))).toEqual({
      ok: false,
      reason: 'Cabeçalho sem as colunas obrigatórias: email, celular.',
    });
  });

  it('dado CSV com 10 mil linhas, então lê todas sob demanda', async () => {
    const lines = Array.from({ length: 10_000 }, (_, i) => `Pessoa ${i};p${i}@x.com;${i}`);

    const rows = await rowsOf(['nome;email;celular', ...lines].join('\n'));

    expect(rows).toHaveLength(10_000);
    expect(rows.at(-1)?.lineNumber).toBe(10_001);
  });
});
