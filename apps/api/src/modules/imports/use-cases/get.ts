import type { Import } from '@contatos/contracts';

import { importNotFound } from '../domain/errors';
import { isImportId, toImport } from '../domain/import';
import type { ImportsRepository } from '../repository';

/** Status e contadores para o acompanhamento por polling (RF17). */
export async function getImport(
  imports: ImportsRepository,
  ownerId: string,
  id: string,
): Promise<Import> {
  const found = isImportId(id) ? await imports.findById(ownerId, id) : undefined;
  if (!found) throw importNotFound();
  return toImport(found);
}
