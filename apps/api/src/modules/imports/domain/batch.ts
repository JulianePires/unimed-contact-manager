import type { CreateContactData, FieldError } from '@contatos/contracts';

import type { CsvRow } from './csv-reader';
import type { DuplicateTracker } from './duplicate-tracker';
import { validateRow } from './row-validator';

export type PreparedRow =
  | { ok: true; lineNumber: number; contact: CreateContactData }
  | { ok: false; lineNumber: number; raw: CsvRow['raw']; errors: FieldError[] };

/**
 * Destino de uma linha (ADR-002): inválida → erro com os campos; válida mas com celular já visto
 * no arquivo → `DUPLICATE_IN_FILE` (RN12); senão segue para o INSERT, que decide entre criada e
 * ignorada (RN11). Na retomada, roda também nas linhas já gravadas para reconstruir as duplicatas.
 */
export function prepareRow(row: CsvRow, duplicates: DuplicateTracker): PreparedRow {
  const rejected = (errors: FieldError[]): PreparedRow => ({
    ok: false,
    lineNumber: row.lineNumber,
    raw: row.raw,
    errors,
  });
  const validation = validateRow(row);
  if (!validation.ok) return rejected(validation.errors);
  const duplicate = duplicates.check(validation.contact.mobile, row.lineNumber);
  if (duplicate) return rejected([duplicate]);
  return { ok: true, lineNumber: row.lineNumber, contact: validation.contact };
}

export interface BatchPlan {
  contacts: CreateContactData[];
  rejected: Extract<PreparedRow, { ok: false }>[];
}

export function planBatch(rows: readonly PreparedRow[]): BatchPlan {
  const plan: BatchPlan = { contacts: [], rejected: [] };
  for (const row of rows) {
    if (row.ok) plan.contacts.push(row.contact);
    else plan.rejected.push(row);
  }
  return plan;
}
