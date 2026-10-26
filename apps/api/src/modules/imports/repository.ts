import type { PaginationQuery } from '@contatos/contracts';
import { and, count, desc, eq } from 'drizzle-orm';

import { single } from '@/shared/db/rows';
import { type Import, importFiles, imports } from '@/shared/db/schema';
import type { Executor } from '@/shared/db/transaction';

export interface NewImportData {
  ownerId: string;
  fileName: string;
  fileSha256: string;
  content: Uint8Array;
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
