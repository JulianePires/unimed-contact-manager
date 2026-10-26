import { importNotFound } from '../domain/errors';
import { ERRORS_CSV_HEADER, toErrorsCsvLine } from '../domain/errors-csv';
import { isImportId } from '../domain/import';
import type { ImportsRepository } from '../repository';

export interface ErrorsCsv {
  fileName: string;
  lines: AsyncIterable<string>;
}

async function* csvLines(imports: ImportsRepository, importId: string): AsyncGenerator<string> {
  yield ERRORS_CSV_HEADER;
  for await (const error of imports.errorsInLineOrder(importId)) yield toErrorsCsvLine(error);
}

/** CSV de erros para correção e reenvio (RF19), gerado sob demanda, linha a linha. */
export async function exportImportErrors(
  imports: ImportsRepository,
  ownerId: string,
  importId: string,
): Promise<ErrorsCsv> {
  const owned = isImportId(importId) && (await imports.findById(ownerId, importId));
  if (!owned) throw importNotFound();
  return { fileName: `erros-importacao-${importId}.csv`, lines: csvLines(imports, importId) };
}
