import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { Import as ImportRow } from '@/shared/db/schema';

import type { ImportsRepository, NewImportData } from '../repository';
import { deleteImport } from './delete';
import { type EnqueueImportDeps, enqueueImport } from './enqueue';
import { getImport } from './get';
import { listImports } from './list';

const ownerId = '0192f3a1-0000-7000-8000-000000000001';
const id = '0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e';
const now = new Date('2026-10-26T12:00:00.000Z');
const content = new TextEncoder().encode('nome;email;celular\n');
const sha256 = createHash('sha256').update(content).digest('hex');
const upload = { fileName: 'contatos.csv', mimeType: 'text/csv', content };

const row = (overrides: Partial<ImportRow> = {}): ImportRow => ({
  id,
  ownerId,
  fileName: 'contatos.csv',
  fileSha256: sha256,
  status: 'PENDING',
  totalRows: 0,
  processedRows: 0,
  createdCount: 0,
  skippedCount: 0,
  failedCount: 0,
  failureReason: null,
  createdAt: now,
  startedAt: null,
  finishedAt: null,
  ...overrides,
});

function fakeRepository(overrides: Partial<ImportsRepository> = {}): ImportsRepository {
  return {
    insert: () => Promise.resolve(row()),
    findLatestByHash: () => Promise.resolve(undefined),
    findById: () => Promise.resolve(undefined),
    list: () => Promise.resolve({ imports: [row()], total: 1 }),
    delete: () => Promise.resolve(false),
    ...overrides,
  };
}

/** Unidade de trabalho em memória que registra a ordem das escritas. */
function enqueueDeps(imports: ImportsRepository = fakeRepository()) {
  const steps: string[] = [];
  const deps: EnqueueImportDeps = {
    imports,
    inTransaction: (work) =>
      work({
        imports: fakeRepository({
          insert: (data: NewImportData) => {
            steps.push(`insert ${data.fileName} ${data.fileSha256}`);
            return Promise.resolve(row());
          },
        }),
        enqueue: (name, payload) => {
          steps.push(`enqueue ${name} ${payload.importId}`);
          return Promise.resolve();
        },
      }),
  };
  return { deps, steps };
}

describe('enqueueImport (RF15, RN13)', () => {
  it('dado CSV novo, então grava com o SHA-256 e enfileira o processamento na mesma unidade', async () => {
    const { deps, steps } = enqueueDeps();

    const created = await enqueueImport(deps, ownerId, upload, false);

    expect(steps).toEqual([`insert contatos.csv ${sha256}`, `enqueue process-import ${id}`]);
    expect(created).toMatchObject({ id, status: 'PENDING' });
  });

  it('dado arquivo já importado sem force, então 409 com a anterior e nada gravado', async () => {
    const { deps, steps } = enqueueDeps(
      fakeRepository({
        findLatestByHash: () => Promise.resolve({ id: 'anterior', createdAt: now }),
      }),
    );

    await expect(enqueueImport(deps, ownerId, upload, false)).rejects.toMatchObject({
      status: 409,
      code: 'IMPORT_ALREADY_EXISTS',
      extras: { importId: 'anterior' },
    });
    expect(steps).toEqual([]);
  });

  it('dado force=true, então nem consulta o hash e cria outra importação', async () => {
    const { deps, steps } = enqueueDeps(
      fakeRepository({
        findLatestByHash: () => Promise.reject(new Error('não deveria consultar')),
      }),
    );

    await enqueueImport(deps, ownerId, upload, true);

    expect(steps).toHaveLength(2);
  });

  it('dado arquivo que não é CSV, então 415 antes de qualquer consulta', async () => {
    const { deps, steps } = enqueueDeps();

    await expect(
      enqueueImport(deps, ownerId, { ...upload, fileName: 'foto.png' }, false),
    ).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_FILE_TYPE' });
    expect(steps).toEqual([]);
  });
});

describe('getImport, listImports e deleteImport', () => {
  it('get devolve a importação do usuário', async () => {
    const imports = fakeRepository({
      findById: () => Promise.resolve(row({ status: 'COMPLETED' })),
    });

    expect(await getImport(imports, ownerId, id)).toMatchObject({ id, status: 'COMPLETED' });
  });

  it.each([
    ['inexistente ou de outro usuário', id],
    ['com id malformado', 'nao-e-uuid'],
  ])('get e delete de importação %s → 404', async (_, importId) => {
    await expect(getImport(fakeRepository(), ownerId, importId)).rejects.toMatchObject({
      status: 404,
    });
    await expect(deleteImport(fakeRepository(), ownerId, importId)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('delete remove a importação do usuário', async () => {
    const imports = fakeRepository({ delete: () => Promise.resolve(true) });

    await expect(deleteImport(imports, ownerId, id)).resolves.toBeUndefined();
  });

  it('list monta o envelope paginado', async () => {
    const page = await listImports(fakeRepository(), ownerId, { page: 1, pageSize: 20 });

    expect(page.meta).toEqual({ page: 1, pageSize: 20, total: 1, totalPages: 1 });
    expect(page.data).toHaveLength(1);
  });
});
