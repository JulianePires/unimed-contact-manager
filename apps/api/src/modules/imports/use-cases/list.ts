import { type Import, type Page, type PaginationQuery, pageMeta } from '@contatos/contracts';

import { toImport } from '../domain/import';
import type { ImportsRepository } from '../repository';

/** Histórico de importações, mais recentes primeiro (RF21). */
export async function listImports(
  imports: ImportsRepository,
  ownerId: string,
  query: PaginationQuery,
): Promise<Page<Import>> {
  const { imports: records, total } = await imports.list(ownerId, query);
  return { data: records.map(toImport), meta: pageMeta(query, total) };
}
