import type { FieldError, ImportError } from '@contatos/contracts';

import { formatCsvLine } from './csv-escape';
import { CONTACT_FIELDS, CSV_COLUMNS, type CsvColumn } from './csv-sniffer';

/** Linha com erro como persistida (`import_errors`); `raw` é nulo depois do expurgo (RN15). */
export interface ImportErrorRecord {
  lineNumber: number;
  raw: Partial<Record<string, string>> | null;
  errors: FieldError[];
}

export function toImportError(record: ImportErrorRecord): ImportError {
  if (record.raw === null) {
    return { lineNumber: record.lineNumber, raw: null, rawPurged: true, errors: record.errors };
  }
  const raw: Record<string, string> = {};
  for (const [column, value] of Object.entries(record.raw)) {
    if (value !== undefined) raw[column] = value;
  }
  return { lineNumber: record.lineNumber, raw, errors: record.errors };
}

const COLUMNS: readonly CsvColumn[] = CONTACT_FIELDS.map((field) => CSV_COLUMNS[field]);
const BOM = '﻿';
const DELIMITER = ';';
const EOL = '\r\n';

/** Motivo legível: `email: Informe um e-mail válido. | celular: …` (erros da linha inteira sem campo). */
export function describeErrors(errors: readonly FieldError[]): string {
  return errors.map(({ field, message }) => (field ? `${field}: ${message}` : message)).join(' | ');
}

/**
 * CSV de erros (RF19, UC14): linha original + coluna `motivo`, para corrigir e reenviar. Em `;` e
 * UTF-8 com BOM (Excel pt-BR) e com toda célula neutralizada contra fórmulas (ADR-009 §5).
 */
export const ERRORS_CSV_HEADER = `${BOM}${formatCsvLine(['linha', ...COLUMNS, 'motivo'], DELIMITER)}${EOL}`;

export function toErrorsCsvLine({ lineNumber, raw, errors }: ImportErrorRecord): string {
  const cells = [
    String(lineNumber),
    ...COLUMNS.map((column) => raw?.[column] ?? ''),
    describeErrors(errors),
  ];
  return `${formatCsvLine(cells, DELIMITER)}${EOL}`;
}
