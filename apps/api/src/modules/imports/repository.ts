import type { FieldError, ImportStatus, PaginationQuery } from '@contatos/contracts';
import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';

import { single } from '@/shared/db/rows';
import { type Import, importErrors, importFiles, imports } from '@/shared/db/schema';
import type { Executor } from '@/shared/db/transaction';

export interface NewImportData {
  ownerId: string;
  fileName: string;
  fileSha256: string;
  content: Uint8Array;
}

export interface BatchResult {
  processed: number;
  created: number;
  skipped: number;
  errors: { lineNumber: number; raw: Record<string, string>; errors: FieldError[] }[];
}

export function createImportsRepository(db: Executor) {
  const byId = (ownerId: string, id: string) =>
    and(eq(imports.ownerId, ownerId), eq(imports.id, id));

  return {
    /** Registro (PENDING) e conteúdo; chamado dentro da transação que também enfileira o job. */
    async insert({ content, ...data }: NewImportData): Promise<Import> {
      const created = single(await db.insert(imports).values(data).returning());
      await db.insert(importFiles).values({ importId: created.id, content: Buffer.from(content) });
      return created;
    },

    /** Importação mais recente com o mesmo conteúdo (RN13, `imports_owner_hash_idx`). */
    async findLatestByHash(
      ownerId: string,
      fileSha256: string,
    ): Promise<Pick<Import, 'id' | 'createdAt'> | undefined> {
      const [latest] = await db
        .select({ id: imports.id, createdAt: imports.createdAt })
        .from(imports)
        .where(and(eq(imports.ownerId, ownerId), eq(imports.fileSha256, fileSha256)))
        .orderBy(desc(imports.createdAt), desc(imports.id))
        .limit(1);
      return latest;
    },

    async findById(ownerId: string, id: string): Promise<Import | undefined> {
      const [found] = await db.select().from(imports).where(byId(ownerId, id));
      return found;
    },

    /** Histórico, mais recentes primeiro, com desempate estável por id (RF21). */
    async list(
      ownerId: string,
      { page, pageSize }: PaginationQuery,
    ): Promise<{ imports: Import[]; total: number }> {
      const owned = eq(imports.ownerId, ownerId);
      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(imports)
          .where(owned)
          .orderBy(desc(imports.createdAt), desc(imports.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ total: count() }).from(imports).where(owned),
      ]);
      return { imports: rows, total: single(totals).total };
    },

    /** Importação e conteúdo para o worker; sem conteúdo se o arquivo já foi expurgado. */
    async findForProcessing(
      id: string,
    ): Promise<{ record: Import; content: Buffer | undefined } | undefined> {
      const [found] = await db
        .select({ record: imports, content: importFiles.content })
        .from(imports)
        .leftJoin(importFiles, eq(importFiles.importId, imports.id))
        .where(eq(imports.id, id));
      return found && { record: found.record, content: found.content ?? undefined };
    },

    async startProcessing(id: string, now: Date): Promise<void> {
      await db
        .update(imports)
        .set({ status: 'PROCESSING', startedAt: sql`coalesce(${imports.startedAt}, ${now})` })
        .where(eq(imports.id, id));
    },

    async setTotalRows(id: string, totalRows: number): Promise<void> {
      await db.update(imports).set({ totalRows }).where(eq(imports.id, id));
    },

    /**
     * Checkpoint do lote (ADR-002): erros e contadores, na transação que também gravou os
     * contatos. Só aplica se `processed_rows` ainda for o lido; `false` indica que outra execução
     * já gravou este lote.
     */
    async recordBatch(id: string, expectedProcessed: number, batch: BatchResult): Promise<boolean> {
      if (batch.errors.length > 0) {
        await db
          .insert(importErrors)
          .values(batch.errors.map((error) => ({ importId: id, ...error })));
      }
      const updated = await db
        .update(imports)
        .set({
          processedRows: sql`${imports.processedRows} + ${batch.processed}`,
          createdCount: sql`${imports.createdCount} + ${batch.created}`,
          skippedCount: sql`${imports.skippedCount} + ${batch.skipped}`,
          failedCount: sql`${imports.failedCount} + ${batch.errors.length}`,
        })
        .where(and(eq(imports.id, id), eq(imports.processedRows, expectedProcessed)))
        .returning({ id: imports.id });
      return updated.length > 0;
    },

    /** Status final e expurgo do conteúdo do arquivo (ADR-009 §3). */
    async finish(
      id: string,
      { status, failureReason, now }: { status: ImportStatus; failureReason?: string; now: Date },
    ): Promise<void> {
      await db
        .update(imports)
        .set({ status, failureReason: failureReason ?? null, finishedAt: now })
        .where(eq(imports.id, id));
      await db.delete(importFiles).where(eq(importFiles.importId, id));
    },

    /** Retenção (RN15): `raw` das linhas com erro de importações encerradas antes do corte. */
    async purgeErrorRawBefore(cutoff: Date): Promise<number> {
      const purged = await db
        .update(importErrors)
        .set({ raw: null })
        .where(
          and(
            isNotNull(importErrors.raw),
            sql`${importErrors.importId} IN (
              SELECT ${imports.id} FROM ${imports}
              WHERE coalesce(${imports.finishedAt}, ${imports.createdAt}) < ${cutoff}
            )`,
          ),
        )
        .returning({ id: importErrors.id });
      return purged.length;
    },

    /**
     * Remove a importação; arquivo e linhas com erro saem em cascata (FK). Contatos já criados
     * permanecem: não têm vínculo com a importação (RF23).
     */
    async delete(ownerId: string, id: string): Promise<boolean> {
      const deleted = await db
        .delete(imports)
        .where(byId(ownerId, id))
        .returning({ id: imports.id });
      return deleted.length > 0;
    },
  };
}

export type ImportsRepository = ReturnType<typeof createImportsRepository>;
