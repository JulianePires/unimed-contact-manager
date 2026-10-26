import { createHash } from 'node:crypto';

import type { Import } from '@contatos/contracts';

import type { JobName, JobPayloads } from '@/shared/queue/job-queue';

import { importAlreadyExists, unsupportedFile } from '../domain/errors';
import { storedFileName, toImport } from '../domain/import';
import { isCsvUpload, type UploadedFile } from '../domain/upload';
import type { ImportsRepository } from '../repository';

/** Escritas que precisam ir juntas: registro, arquivo e job confirmam ou desfazem em bloco. */
export interface ImportsUnitOfWork {
  imports: ImportsRepository;
  enqueue: <N extends JobName>(name: N, payload: JobPayloads[N]) => Promise<void>;
}

export interface EnqueueImportDeps {
  imports: ImportsRepository;
  inTransaction: <T>(work: (unit: ImportsUnitOfWork) => Promise<T>) => Promise<T>;
}

/**
 * Envio (RF15, RN13, ADR-002/003): CSV válido, aviso de reenvio pelo SHA-256 do conteúdo (salvo
 * `force`) e, numa só transação, a importação PENDING, o arquivo e o job de processamento.
 */
export async function enqueueImport(
  { imports, inTransaction }: EnqueueImportDeps,
  ownerId: string,
  file: UploadedFile,
  force: boolean,
): Promise<Import> {
  if (!isCsvUpload(file)) throw unsupportedFile();
  const fileSha256 = createHash('sha256').update(file.content).digest('hex');

  if (!force) {
    const previous = await imports.findLatestByHash(ownerId, fileSha256);
    if (previous) throw importAlreadyExists(previous);
  }

  const created = await inTransaction(async (unit) => {
    const record = await unit.imports.insert({
      ownerId,
      fileName: storedFileName(file.fileName),
      fileSha256,
      content: file.content,
    });
    await unit.enqueue('process-import', { importId: record.id });
    return record;
  });
  return toImport(created);
}
