import type { CsvDelimiter } from './csv-sniffer';

/** Início que planilhas interpretam como fórmula (CSV injection, ADR-009 §5). */
const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /["\r\n,;]/;

/** Neutraliza fórmulas com `'` e aplica as aspas do RFC 4180 quando necessário. */
export function escapeCsvCell(value: string): string {
  const neutralized = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(neutralized) ? `"${neutralized.replaceAll('"', '""')}"` : neutralized;
}

export function formatCsvLine(cells: readonly string[], delimiter: CsvDelimiter): string {
  return cells.map(escapeCsvCell).join(delimiter);
}
