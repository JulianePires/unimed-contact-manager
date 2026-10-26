import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { importContacts } from '@/modules/contacts';
import { importJobs } from '@/modules/imports';
import {
  CheckpointMoved,
  ImportInterrupted,
  type ProcessImportDeps,
  processImport,
} from '@/modules/imports/jobs/process-import';
import { createImportsRepository } from '@/modules/imports/repository';
import { createDatabase, type Database } from '@/shared/db/client';
import { contacts, importErrors, importFiles, imports, type User } from '@/shared/db/schema';

import { startMigratedPostgres, truncateAll } from '../helpers/db-container';
import { buildContact, createUser } from '../helpers/factories';

let container: StartedPostgreSqlContainer;
let db: Database;
let owner: User;

const NOW = new Date('2026-10-26T12:00:00.000Z');
const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url));

beforeAll(async () => {
  container = await startMigratedPostgres();
  db = createDatabase(container.getConnectionUri());
});

afterAll(async () => {
  await db.close();
  await container.stop();
});

beforeEach(async () => {
  await truncateAll(db.orm);
  owner = await createUser(db.orm);
});

const deps = (overrides: Partial<ProcessImportDeps> = {}): ProcessImportDeps => ({
  db: db.orm,
  now: () => NOW,
  importContacts,
  ...overrides,
});

async function enqueued(content: Uint8Array, ownerId = owner.id): Promise<string> {
  const created = await createImportsRepository(db.orm).insert({
    ownerId,
    fileName: 'contatos.csv',
    fileSha256: createHash('sha256').update(content).digest('hex'),
    content,
  });
  return created.id;
}

async function importRow(id: string) {
  const [row] = await db.orm.select().from(imports).where(eq(imports.id, id));
  return row;
}

const counters = async (id: string) => {
  const row = await importRow(id);
  return {
    status: row?.status,
    totalRows: row?.totalRows,
    processedRows: row?.processedRows,
    createdCount: row?.createdCount,
    skippedCount: row?.skippedCount,
    failedCount: row?.failedCount,
  };
};

const storedContacts = () =>
  db.orm
    .select({ name: contacts.name, mobile: contacts.mobileE164 })
    .from(contacts)
    .orderBy(asc(contacts.mobileE164));

const filesOf = (id: string) =>
  db.orm.select().from(importFiles).where(eq(importFiles.importId, id));

describe('processImport (RF16, ADR-002, docs/04 §4.5)', () => {
  it('dado o fixture Windows-1252, então importa com os acentos corretos e apaga o arquivo', async () => {
    const id = await enqueued(fixture('win1252-ponto-e-virgula.csv'));

    await processImport(deps(), id);

    expect(await counters(id)).toEqual({
      status: 'COMPLETED',
      totalRows: 3,
      processedRows: 3,
      createdCount: 3,
      skippedCount: 0,
      failedCount: 0,
    });
    expect((await storedContacts()).map(({ name }) => name).sort()).toEqual([
      'Inês Müller',
      'José Conceição',
      'Sônia Ferreira',
    ]);
    expect(await importRow(id)).toMatchObject({ startedAt: NOW, finishedAt: NOW });
    expect(await filesOf(id)).toEqual([]);
  });

  it('T-INT11: válidas, inválidas e celular já na agenda → contadores exatos e contato existente intacto', async () => {
    await db.orm
      .insert(contacts)
      .values(buildContact(owner.id, { name: 'Já existia', mobileE164: '+5581999990010' }));
    const id = await enqueued(fixture('linhas-invalidas.csv'));

    await processImport(deps(), id);

    expect(await counters(id)).toEqual({
      status: 'COMPLETED_WITH_ERRORS',
      totalRows: 8,
      processedRows: 8,
      createdCount: 2,
      skippedCount: 1,
      failedCount: 5,
    });
    const existing = await db.orm
      .select()
      .from(contacts)
      .where(eq(contacts.mobileE164, '+5581999990010'));
    expect(existing).toEqual([expect.objectContaining({ name: 'Já existia' })]);
    const errors = await db.orm
      .select({ line: importErrors.lineNumber, raw: importErrors.raw, errors: importErrors.errors })
      .from(importErrors)
      .orderBy(asc(importErrors.lineNumber));
    expect(errors.map(({ line }) => line)).toEqual([3, 5, 6, 7, 8]);
    expect(errors[0]).toMatchObject({
      raw: { nome: 'A', email: 'joao@', celular: '8133330000', telefone: '' },
      errors: [
        expect.objectContaining({ field: 'nome', code: 'NAME_TOO_SHORT' }),
        expect.objectContaining({ field: 'email', code: 'INVALID_EMAIL' }),
        expect.objectContaining({ field: 'celular', code: 'NOT_A_MOBILE_NUMBER' }),
      ],
    });
  });

  it('dado celular repetido no arquivo, então DUPLICATE_IN_FILE com firstLine', async () => {
    const id = await enqueued(fixture('duplicados-no-arquivo.csv'));

    await processImport(deps(), id);

    expect(await counters(id)).toMatchObject({ createdCount: 2, failedCount: 2 });
    const errors = await db.orm.select({ errors: importErrors.errors }).from(importErrors);
    expect(errors.flatMap((row) => row.errors)).toEqual([
      expect.objectContaining({ code: 'DUPLICATE_IN_FILE', firstLine: 2 }),
      expect.objectContaining({ code: 'DUPLICATE_IN_FILE', firstLine: 2 }),
    ]);
  });

  it('T-INT12a: reprocessar o mesmo arquivo (force) → created = 0 e todos skipped', async () => {
    const content = fixture('utf8-virgula.csv');
    await processImport(deps(), await enqueued(content));
    const again = await enqueued(content);

    await processImport(deps(), again);

    expect(await counters(again)).toMatchObject({
      status: 'COMPLETED',
      createdCount: 0,
      skippedCount: 3,
    });
    expect(await storedContacts()).toHaveLength(3);
  });

  it('T-INT12b: falha no lote 2 e reexecução → totais iguais a uma execução limpa e sem duplicados', async () => {
    const content = fixture('linhas-invalidas.csv');
    const reference = await enqueued(content, (await createUser(db.orm)).id);
    await processImport(deps({ batchSize: 3 }), reference);

    let batches = 0;
    const failingOnSecond: ProcessImportDeps['importContacts'] = async (...args) => {
      batches += 1;
      if (batches === 2) throw new Error('worker morreu no lote 2');
      return importContacts(...args);
    };
    const id = await enqueued(content);
    await expect(
      processImport(deps({ batchSize: 3, importContacts: failingOnSecond }), id),
    ).rejects.toThrow('worker morreu no lote 2');
    expect(await counters(id)).toMatchObject({ status: 'PROCESSING', processedRows: 3 });

    await processImport(deps({ batchSize: 3 }), id);

    const { status, ...totals } = await counters(id);
    const { status: referenceStatus, ...referenceTotals } = await counters(reference);
    expect(status).toBe(referenceStatus);
    expect(totals).toEqual(referenceTotals);
    const mine = await db.orm.select().from(contacts).where(eq(contacts.ownerId, owner.id));
    expect(new Set(mine.map((contact) => contact.mobileE164)).size).toBe(mine.length);
    expect(mine).toHaveLength(totals.createdCount ?? -1);
    expect(
      await db.orm.select().from(importErrors).where(eq(importErrors.importId, id)),
    ).toHaveLength(totals.failedCount ?? -1);
  });

  it('dado pedido de parada, então termina o lote atual, para e retoma do checkpoint', async () => {
    const id = await enqueued(fixture('utf8-virgula.csv'));
    const stop = new AbortController();
    stop.abort();

    await expect(processImport(deps({ batchSize: 2 }), id, stop.signal)).rejects.toBeInstanceOf(
      ImportInterrupted,
    );
    expect(await counters(id)).toMatchObject({ status: 'PROCESSING', processedRows: 2 });

    await processImport(deps({ batchSize: 2 }), id);

    expect(await counters(id)).toMatchObject({ status: 'COMPLETED', createdCount: 3 });
  });

  it('dada outra execução gravando o mesmo lote, então esta desiste e desfaz seus contatos', async () => {
    const id = await enqueued(fixture('utf8-virgula.csv'));
    const concurrent: ProcessImportDeps['importContacts'] = async (tx, ...args) => {
      const result = await importContacts(tx, ...args);
      await db.orm.update(imports).set({ processedRows: 3 }).where(eq(imports.id, id));
      return result;
    };

    await expect(processImport(deps({ importContacts: concurrent }), id)).rejects.toBeInstanceOf(
      CheckpointMoved,
    );

    expect(await storedContacts()).toEqual([]);
    expect(await counters(id)).toMatchObject({ processedRows: 3, createdCount: 0 });
  });

  it('dado cabeçalho inválido, então FAILED com failure_reason e arquivo apagado', async () => {
    const id = await enqueued(fixture('cabecalho-invalido.csv'));

    await processImport(deps(), id);

    expect(await importRow(id)).toMatchObject({
      status: 'FAILED',
      failureReason: 'Cabeçalho sem as colunas obrigatórias: celular.',
      finishedAt: NOW,
    });
    expect(await filesOf(id)).toEqual([]);
  });

  it('dado arquivo ausente, então FAILED com motivo', async () => {
    const id = await enqueued(fixture('utf8-virgula.csv'));
    await db.orm.delete(importFiles).where(eq(importFiles.importId, id));

    await processImport(deps(), id);

    expect(await importRow(id)).toMatchObject({
      status: 'FAILED',
      failureReason: 'Arquivo da importação não encontrado.',
    });
  });

  it('dada importação já encerrada ou excluída, então o job não faz nada', async () => {
    const id = await enqueued(fixture('utf8-virgula.csv'));
    await processImport(deps(), id);

    await processImport(deps(), id);
    await processImport(deps(), '0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e');

    expect(await counters(id)).toMatchObject({ createdCount: 3, processedRows: 3 });
  });
});

describe('purgeRetention (RN15, ADR-009 §3)', () => {
  it('T-INT18: apaga raw só de importações encerradas há mais de N dias; contadores preservados', async () => {
    const old = await enqueued(fixture('linhas-invalidas.csv'));
    await processImport(deps({ now: () => new Date('2026-09-20T12:00:00.000Z') }), old);
    const recent = await enqueued(fixture('duplicados-no-arquivo.csv'));
    await processImport(deps(), recent);

    const jobs = importJobs({ db: db.orm, now: () => NOW, retentionDays: 30 });

    const purged = await jobs['purge-retention']({}, new AbortController().signal);

    expect(purged).toBe(5);
    const rawOf = async (importId: string) =>
      (
        await db.orm
          .select({ raw: importErrors.raw })
          .from(importErrors)
          .where(eq(importErrors.importId, importId))
      ).map(({ raw }) => raw);
    expect(await rawOf(old)).toEqual([null, null, null, null, null]);
    expect((await rawOf(recent)).every((raw) => raw !== null)).toBe(true);
    expect(await counters(old)).toMatchObject({ failedCount: 5, createdCount: 3 });
  });
});
