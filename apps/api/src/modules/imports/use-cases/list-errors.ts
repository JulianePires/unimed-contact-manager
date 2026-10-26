import { type ImportError, type Page, type PaginationQuery, pageMeta } from '@contatos/contracts';

import { importNotFound } from '../domain/errors';
import { toImportError } from '../domain/errors-csv';
import { isImportId } from '../domain/import';
import type { ImportsRepository } from '../repository';

/**
 * Linhas rejeitadas com os motivos por campo (RF18, UC14). Depois do expurgo (RN15), `raw` vem
 * nulo com `rawPurged`, e linha, código e mensagem continuam disponíveis.
 */
export async function listImportErrors(
  imports: ImportsRepository,
  ownerId: string,
  importId: string,
  query: PaginationQuery,
): Promise<Page<ImportError>> {
  const owned = isImportId(importId) && (await imports.findById(ownerId, importId));
  if (!owned) throw importNotFound();
  const { errors, total } = await imports.listErrors(importId, query);
  return { data: errors.map(toImportError), meta: pageMeta(query, total) };
}
