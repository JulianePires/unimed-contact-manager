import { readFileSync } from 'node:fs';

import { importSchema, pageSchema, problemDetailsSchema } from '@contatos/contracts';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { readCsv } from '@/modules/imports/domain/csv-reader';
import { createDatabase, type Database } from '@/shared/db/client';
import { withTransaction } from '@/shared/db/transaction';
import { contacts, importErrors, importFiles, imports } from '@/shared/db/schema';
import { type PgBossQueue, startPgBossQueue } from '@/shared/queue/pg-boss-adapter';

import { buildTestApp, CSRF_HEADERS, registerUser, type TestApp } from '../helpers/app';
import { startMigratedPostgres, truncateAll } from '../helpers/db-container';
import { buildContact } from '../helpers/factories';
import { type FilePart, multipartFile } from '../helpers/multipart';

let container: StartedPostgreSqlContainer;
let db: Database;
let queue: PgBossQueue;
let app: TestApp;
let alice: { id: string; cookie: string };
let bob: { id: string; cookie: string };

const CSV = readFileSync(new URL('../fixtures/utf8-virgula.csv', import.meta.url));

beforeAll(async () => {
  container = await startMigratedPostgres();
  db = createDatabase(container.getConnectionUri());
  queue = await startPgBossQueue(container.getConnectionUri());
  app = await buildTestApp(db, { jobQueue: queue.queue });
});

afterAll(async () => {
  await app.close();
  await queue.stop();
  await db.close();
  await container.stop();
});

beforeEach(async () => {
  await truncateAll(db.orm);
  const [a, b] = [await registerUser(app), await registerUser(app)];
  alice = { id: a.user.id, cookie: a.cookie };
  bob = { id: b.user.id, cookie: b.cookie };
});

function upload(
  cookie: string,
  file: Partial<FilePart> = {},
  { force, target = app }: { force?: boolean; target?: TestApp } = {},
) {
  const { payload, headers } = multipartFile({ fileName: 'contatos.csv', content: CSV, ...file });
  return target.inject({
    method: 'POST',
    url: '/api/v1/imports',
    query: force === undefined ? {} : { force: String(force) },
    headers: { ...CSRF_HEADERS, ...headers, cookie },
    payload,
  });
}

const get = (cookie: string, url: string) =>
  app.inject({ method: 'GET', url: `/api/v1/imports${url}`, headers: { cookie } });

const problemOf = (body: string) => problemDetailsSchema.parse(JSON.parse(body));

const jobsFor = async (importId: string) => {
  const { rows } = await db.orm.execute<{ total: number }>(
    sql`SELECT count(*)::int AS total FROM pgboss.job
        WHERE name = 'process-import' AND data->>'importId' = ${importId}`,
  );
  return rows[0]?.total;
};

const importRows = () => db.orm.select().from(imports);

describe('POST /imports (RF15, ADR-003)', () => {
  it('dado CSV válido, então 202 + Location, importação PENDING, arquivo e job na mesma transação', async () => {
    const response = await upload(alice.cookie, { fileName: 'C:\\Users\\ana\\clientes.csv' });

    expect(response.statusCode).toBe(202);
    const created = importSchema.parse(response.json());
    expect(created).toMatchObject({ status: 'PENDING', fileName: 'clientes.csv', totalRows: 0 });
    expect(response.headers.location).toBe(`/api/v1/imports/${created.id}`);
    const [file] = await db.orm
      .select()
      .from(importFiles)
      .where(eq(importFiles.importId, created.id));
    expect(file?.content.equals(CSV)).toBe(true);
    expect(await jobsFor(created.id)).toBe(1);
  });

  it('dado o mesmo arquivo de novo, então 409 IMPORT_ALREADY_EXISTS com a importação anterior', async () => {
    const first = importSchema.parse((await upload(alice.cookie)).json());

    const response = await upload(alice.cookie, { fileName: 'outro-nome.csv' });

    expect(response.statusCode).toBe(409);
    expect(problemOf(response.body)).toMatchObject({
      code: 'IMPORT_ALREADY_EXISTS',
      importId: first.id,
      importedAt: first.createdAt,
    });
    expect(await importRows()).toHaveLength(1);
  });

  it('dado o mesmo arquivo com force=true, então 202 e uma nova importação (RN13)', async () => {
    const first = importSchema.parse((await upload(alice.cookie)).json());

    const response = await upload(alice.cookie, {}, { force: true });

    expect(response.statusCode).toBe(202);
    const second = importSchema.parse(response.json());
    expect(second.id).not.toBe(first.id);
    expect(await importRows()).toHaveLength(2);
    expect(await jobsFor(second.id)).toBe(1);
  });

  it('dado o mesmo arquivo enviado por outro usuário, então não é reenvio', async () => {
    await upload(alice.cookie);

    expect((await upload(bob.cookie)).statusCode).toBe(202);
  });

  it('dado arquivo acima de IMPORT_MAX_BYTES, então 413 FILE_TOO_LARGE e nada gravado', async () => {
    const small = await buildTestApp(db, { jobQueue: queue.queue, importMaxBytes: 64 });
    try {
      const response = await upload(alice.cookie, {}, { target: small });

      expect(response.statusCode).toBe(413);
      expect(problemOf(response.body)).toMatchObject({ code: 'FILE_TOO_LARGE' });
      expect(await importRows()).toHaveLength(0);
    } finally {
      await small.close();
    }
  });

  it.each([
    ['extensão diferente de .csv', { fileName: 'contatos.xlsx' }],
    ['tipo de imagem', { fileName: 'contatos.csv', contentType: 'image/png' }],
    ['binário renomeado para .csv', { content: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1]) }],
  ])('dado %s, então 415 UNSUPPORTED_FILE_TYPE', async (_, file) => {
    const response = await upload(alice.cookie, file);

    expect(response.statusCode).toBe(415);
    expect(problemOf(response.body)).toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' });
  });

  it('dado corpo que não é multipart, então 415', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports',
      headers: { ...CSRF_HEADERS, cookie: alice.cookie },
      payload: { file: 'nome;email;celular' },
    });

    expect(response.statusCode).toBe(415);
  });

  it('dado multipart sem o campo file, então 422 com o erro no campo', async () => {
    const response = await upload(alice.cookie, { field: 'arquivo' });

    expect(response.statusCode).toBe(422);
    expect(problemOf(response.body).errors).toEqual([
      expect.objectContaining({ field: 'file', code: 'REQUIRED' }),
    ]);
  });

  const CRLF = '\r\n';

  it.each([
    [
      'sem nenhum arquivo',
      ['--B', 'Content-Disposition: form-data; name="obs"', '', 'oi', '--B--', ''].join(CRLF),
      422,
    ],
    [
      'truncado',
      ['--B', 'Content-Disposition: form-data; name="file"; filename="a.csv"', '', 'nome'].join(
        CRLF,
      ),
      400,
    ],
    ['malformado', 'não é multipart', 400],
  ])('dado multipart %s, então %i', async (_, payload, status) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports',
      headers: {
        ...CSRF_HEADERS,
        cookie: alice.cookie,
        'content-type': 'multipart/form-data; boundary=B',
      },
      payload,
    });

    expect(response.statusCode).toBe(status);
    expect(await importRows()).toHaveLength(0);
  });

  it('dado force inválido, então 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/imports?force=talvez',
      headers: { ...CSRF_HEADERS, cookie: alice.cookie },
    });

    expect(response.statusCode).toBe(400);
  });

  it('dada falha ao enfileirar o job, então rollback: nenhuma linha em imports nem import_files (T-INT13)', async () => {
    const failing = await buildTestApp(db, {
      jobQueue: { enqueue: () => Promise.reject(new Error('pg-boss indisponível')) },
    });
    try {
      const response = await upload(alice.cookie, {}, { target: failing });

      expect(response.statusCode).toBe(500);
      expect(await importRows()).toHaveLength(0);
      expect(await db.orm.select().from(importFiles)).toHaveLength(0);
    } finally {
      await failing.close();
    }
  });

  it('dada requisição sem sessão, então 401', async () => {
    expect((await upload('')).statusCode).toBe(401);
  });
});

describe('fila transacional com pg-boss (ADR-003)', () => {
  const importId = '0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e';

  it('dada transação desfeita depois do envio, então o job também não existe', async () => {
    const failed = withTransaction(db.orm, async (tx) => {
      await queue.queue.enqueue(tx, 'process-import', { importId });
      throw new Error('falha depois de enfileirar');
    });

    await expect(failed).rejects.toThrow('falha depois de enfileirar');
    expect(await jobsFor(importId)).toBe(0);
  });

  it('dada transação confirmada, então o job fica disponível para o worker', async () => {
    await withTransaction(db.orm, (tx) => queue.queue.enqueue(tx, 'process-import', { importId }));

    expect(await jobsFor(importId)).toBe(1);
  });
});

describe('consulta, histórico e modelo (RF17, RF20, RF21)', () => {
  it('GET /imports/:id devolve status e contadores', async () => {
    const created = importSchema.parse((await upload(alice.cookie)).json());

    const response = await get(alice.cookie, `/${created.id}`);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(created);
  });

  it('GET /imports lista as mais recentes primeiro, paginado', async () => {
    const older = importSchema.parse((await upload(alice.cookie)).json());
    const newer = importSchema.parse((await upload(alice.cookie, {}, { force: true })).json());

    const response = await get(alice.cookie, '?pageSize=1');

    const page = pageSchema(importSchema).parse(response.json());
    expect(page.data.map(({ id }) => id)).toEqual([newer.id]);
    expect(page.meta).toEqual({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
    const second = pageSchema(importSchema).parse(
      (await get(alice.cookie, '?page=2&pageSize=1')).json(),
    );
    expect(second.data.map(({ id }) => id)).toEqual([older.id]);
  });

  it('GET /imports/template.csv baixa um modelo que a própria importação aceita', async () => {
    const response = await get(alice.cookie, '/template.csv');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="modelo-importacao-contatos.csv"',
    );
    const document = await readCsv(response.rawPayload);
    expect(document).toMatchObject({ ok: true, delimiter: ';', encoding: 'utf-8' });
    if (!document.ok) return;
    const rows = [];
    for await (const row of document.rows) rows.push(row.raw.nome);
    expect(rows).toEqual(['Maria Silva', 'João Souza']);
  });
});

describe('DELETE /imports/:id (RF23)', () => {
  it('remove a importação, o arquivo e os erros; os contatos criados permanecem', async () => {
    const created = importSchema.parse((await upload(alice.cookie)).json());
    await db.orm.insert(importErrors).values({
      importId: created.id,
      lineNumber: 3,
      raw: { nome: 'A' },
      errors: [{ field: 'nome', code: 'NAME_TOO_SHORT', message: 'Curto.' }],
    });
    await db.orm
      .insert(contacts)
      .values(buildContact(alice.id, { name: 'Criado pela importação' }));

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/imports/${created.id}`,
      headers: { ...CSRF_HEADERS, cookie: alice.cookie },
    });

    expect(response.statusCode).toBe(204);
    expect(await importRows()).toHaveLength(0);
    expect(await db.orm.select().from(importFiles)).toHaveLength(0);
    expect(await db.orm.select().from(importErrors)).toHaveLength(0);
    expect(await db.orm.select().from(contacts)).toHaveLength(1);
    expect((await get(alice.cookie, `/${created.id}`)).statusCode).toBe(404);
  });
});

describe('isolamento entre usuários (T-INT05, RN06)', () => {
  it('importação de outro usuário: GET e DELETE respondem 404 e o histórico não a mostra', async () => {
    const created = importSchema.parse((await upload(alice.cookie)).json());

    const responses = await Promise.all([
      get(bob.cookie, `/${created.id}`),
      app.inject({
        method: 'DELETE',
        url: `/api/v1/imports/${created.id}`,
        headers: { ...CSRF_HEADERS, cookie: bob.cookie },
      }),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([404, 404]);
    expect(pageSchema(importSchema).parse((await get(bob.cookie, '')).json()).meta.total).toBe(0);
    expect(await importRows()).toHaveLength(1);
  });

  it.each([
    ['GET', '/nao-e-uuid'],
    ['DELETE', '/nao-e-uuid'],
  ] as const)('%s com id malformado → 404', async (method, url) => {
    const response = await app.inject({
      method,
      url: `/api/v1/imports${url}`,
      headers: { ...CSRF_HEADERS, cookie: alice.cookie },
    });

    expect(response.statusCode).toBe(404);
  });
});
