import { importNotFound } from '../domain/errors';
import { isImportId } from '../domain/import';
import type { ImportsRepository } from '../repository';

/** Exclui a importação e seus erros (RF23, ADR-009); os contatos criados permanecem. */
export async function deleteImport(
  imports: ImportsRepository,
  ownerId: string,
  id: string,
): Promise<void> {
  const deleted = isImportId(id) && (await imports.delete(ownerId, id));
  if (!deleted) throw importNotFound();
}
