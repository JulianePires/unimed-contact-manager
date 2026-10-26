import { type CreateContactData, isTerminalImportStatus } from '@contatos/contracts';

import type { Orm } from '@/shared/db/client';
import { type Executor, withTransaction } from '@/shared/db/transaction';

import { planBatch, type PreparedRow, prepareRow } from '../domain/batch';
import { readCsv } from '../domain/csv-reader';
import { createDuplicateTracker } from '../domain/duplicate-tracker';
import { finalStatusOf, transition } from '../domain/import-status';
import { createImportsRepository } from '../repository';

export const DEFAULT_BATCH_SIZE = 500;

export interface ProcessImportDeps {
  db: Orm;
  now: () => Date;
  importContacts: (
    tx: Executor,
    ownerId: string,
    batch: readonly CreateContactData[],
  ) => Promise<{ created: number; skipped: number }>;
  batchSize?: number;
}

/** Parada pedida entre lotes (desligamento gracioso): o pg-boss retoma do checkpoint depois. */
export class ImportInterrupted extends Error {
  constructor(readonly importId: string) {
    super(`Importação ${importId} interrompida entre lotes`);
    this.name = 'ImportInterrupted';
  }
}

/** Outra execução gravou o mesmo lote primeiro; esta desiste sem tocar nos contadores. */
export class CheckpointMoved extends Error {
  constructor(readonly importId: string) {
    super(`Checkpoint da importação ${importId} mudou durante o lote`);
    this.name = 'CheckpointMoved';
  }
}

/** Total de linhas de dados para a barra de progresso (RF17); lê o arquivo sem guardar as linhas. */
async function countRows(content: Uint8Array): Promise<number> {
  const document = await readCsv(content);
  if (!document.ok) return 0;
  const rows = document.rows[Symbol.asyncIterator]();
  let total = 0;
  while ((await rows.next()).done !== true) total += 1;
  return total;
}

/**
 * Job `process-import` (RF16, ADR-002, docs/04 §4.5). Cada lote grava contatos (`ON CONFLICT DO
 * NOTHING`), linhas com erro e contadores numa transação, então `processed_rows` é um checkpoint
 * confiável: numa reexecução, as linhas já gravadas só reconstroem as duplicatas e o
 * processamento continua da seguinte, sem duplicar nada (RNF07).
 */
export async function processImport(
  { db, now, importContacts, batchSize = DEFAULT_BATCH_SIZE }: ProcessImportDeps,
  importId: string,
  signal?: AbortSignal,
): Promise<void> {
  const imports = createImportsRepository(db);
  const loaded = await imports.findForProcessing(importId);
  // Excluída enquanto esperava na fila, ou já encerrada: nada a fazer
  if (!loaded || isTerminalImportStatus(loaded.record.status)) return;
  const { record, content } = loaded;

  transition(record.status, 'PROCESSING');
  await imports.startProcessing(importId, now());

  const fail = (failureReason: string) =>
    imports.finish(importId, {
      status: transition('PROCESSING', 'FAILED'),
      failureReason,
      now: now(),
    });
  if (!content) return fail('Arquivo da importação não encontrado.');

  const document = await readCsv(content);
  if (!document.ok) return fail(document.reason);
  if (record.processedRows === 0) await imports.setTotalRows(importId, await countRows(content));

  let processed = record.processedRows;
  let failed = record.failedCount;
  const commit = async (rows: readonly PreparedRow[]) => {
    const { contacts, rejected } = planBatch(rows);
    await withTransaction(db, async (tx) => {
      const { created, skipped } = await importContacts(tx, record.ownerId, contacts);
      const recorded = await createImportsRepository(tx).recordBatch(importId, processed, {
        processed: rows.length,
        created,
        skipped,
        errors: rejected.map(({ lineNumber, raw, errors }) => ({ lineNumber, raw, errors })),
      });
      if (!recorded) throw new CheckpointMoved(importId);
    });
    processed += rows.length;
    failed += rejected.length;
  };

  const duplicates = createDuplicateTracker();
  let position = 0;
  let batch: PreparedRow[] = [];
  for await (const row of document.rows) {
    position += 1;
    const prepared = prepareRow(row, duplicates);
    if (position <= record.processedRows) continue;
    batch.push(prepared);
    if (batch.length < batchSize) continue;
    await commit(batch);
    batch = [];
    if (signal?.aborted) throw new ImportInterrupted(importId);
  }
  if (batch.length > 0) await commit(batch);

  await imports.finish(importId, {
    status: transition('PROCESSING', finalStatusOf({ headerValid: true, failedCount: failed })),
    now: now(),
  });
}
