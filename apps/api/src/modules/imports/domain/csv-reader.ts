import { type Info, type Parser, parse } from 'csv-parse';

import {
  type ColumnIndexes,
  CSV_COLUMNS,
  type CsvColumn,
  type CsvDelimiter,
  type CsvEncoding,
  CONTACT_FIELDS,
  decodeCsv,
  detectDelimiter,
  validateHeader,
} from './csv-sniffer';

/** Linha de dados: `lineNumber` conta o cabeçalho como linha 1 e as linhas em branco (docs/05). */
export interface CsvRow {
  lineNumber: number;
  raw: Partial<Record<CsvColumn, string>>;
  columnCount: number;
  expectedColumnCount: number;
}

export type CsvDocument =
  | { ok: false; reason: string }
  | {
      ok: true;
      encoding: CsvEncoding;
      delimiter: CsvDelimiter;
      columns: ColumnIndexes;
      rows: AsyncIterable<CsvRow>;
    };

interface ParsedRecord {
  info: Info;
  record: string[];
}

interface NumberedRecord {
  lineNumber: number;
  cells: string[];
}

const LINE_BREAK = /\r\n|\r|\n/g;
const CRLF = /\r\n/g;

const countIn = (cells: readonly string[], pattern: RegExp) =>
  cells.reduce((total, cell) => total + (cell.match(pattern)?.length ?? 0), 0);

const isBlank = (cells: readonly string[]) => cells.every((cell) => cell.trim() === '');

/**
 * Registros com conteúdo, numerados pela linha (como no editor) em que começam. O csv-parse informa
 * a linha em que o registro termina e, dentro de campos entre aspas, conta \r\n como duas linhas:
 * o excesso é acumulado e descontado para não deslocar as linhas seguintes.
 */
async function* contentRecords(parser: Parser): AsyncGenerator<NumberedRecord> {
  const records: AsyncIterator<ParsedRecord> = parser[Symbol.asyncIterator]();
  let overcount = 0;
  for (let next = await records.next(); next.done !== true; next = await records.next()) {
    const { info, record } = next.value;
    overcount += countIn(record, CRLF);
    if (isBlank(record)) continue;
    yield { lineNumber: info.lines - overcount - countIn(record, LINE_BREAK), cells: record };
  }
}

function toRaw(cells: readonly string[], columns: ColumnIndexes): CsvRow['raw'] {
  const raw: CsvRow['raw'] = {};
  for (const field of CONTACT_FIELDS) {
    const index = columns[field];
    const value = index === undefined ? undefined : cells[index];
    if (value !== undefined) raw[CSV_COLUMNS[field]] = value;
  }
  return raw;
}

async function* dataRows(
  records: AsyncIterable<NumberedRecord>,
  columns: ColumnIndexes,
  expectedColumnCount: number,
): AsyncGenerator<CsvRow> {
  for await (const { lineNumber, cells } of records) {
    yield {
      lineNumber,
      raw: toRaw(cells, columns),
      columnCount: cells.length,
      expectedColumnCount,
    };
  }
}

/**
 * Lê o CSV em streaming (csv-parse): decodifica, detecta o delimitador, valida o cabeçalho e só
 * então entrega as linhas sob demanda, sem materializar o arquivo inteiro em registros.
 */
export async function readCsv(bytes: Uint8Array): Promise<CsvDocument> {
  const { text, encoding } = decodeCsv(bytes);
  const delimiter = detectDelimiter(text);
  const parser = parse(text, {
    delimiter,
    info: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: true,
  });
  const records = contentRecords(parser);

  const header = await records.next();
  if (header.done === true) return { ok: false, reason: 'Arquivo vazio: falta o cabeçalho.' };

  const validation = validateHeader(header.value.cells);
  if (!validation.ok) {
    parser.destroy();
    return validation;
  }
  return {
    ok: true,
    encoding,
    delimiter,
    columns: validation.columns,
    rows: dataRows(records, validation.columns, validation.columnCount),
  };
}
