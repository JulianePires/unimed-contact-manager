import {
  type CreateContactData,
  createContactInputSchema,
  type FieldError,
  toFieldErrors,
} from '@contatos/contracts';

import type { CsvRow } from './csv-reader';
import { CSV_COLUMNS, type ContactField } from './csv-sniffer';

export type RowValidation =
  | { ok: true; contact: CreateContactData }
  | { ok: false; errors: FieldError[] };

const isContactField = (field: string): field is ContactField => field in CSV_COLUMNS;

/** Erros apontam a coluna do CSV (`celular`), não o campo da API (`mobile`), como em docs/05. */
function toCsvField(error: FieldError): FieldError {
  return isContactField(error.field) ? { ...error, field: CSV_COLUMNS[error.field] } : error;
}

/**
 * Mesmas regras do cadastro pela tela (RN01, RN02): os schemas de `@contatos/contracts` validam e
 * normalizam a linha. Linha com colunas a mais ou a menos não é validada campo a campo, pois os
 * valores podem estar deslocados.
 */
export function validateRow(row: CsvRow): RowValidation {
  if (row.columnCount !== row.expectedColumnCount) {
    return {
      ok: false,
      errors: [
        {
          field: '',
          code: 'COLUMN_COUNT_MISMATCH',
          message: `A linha tem ${row.columnCount} colunas; o cabeçalho tem ${row.expectedColumnCount}.`,
        },
      ],
    };
  }
  const result = createContactInputSchema.safeParse({
    name: row.raw.nome,
    email: row.raw.email,
    mobile: row.raw.celular,
    phone: row.raw.telefone ?? null,
  });
  return result.success
    ? { ok: true, contact: result.data }
    : { ok: false, errors: toFieldErrors(result.error).map(toCsvField) };
}
