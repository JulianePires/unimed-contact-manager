import { createHash } from 'node:crypto';

import { importErrorSchema, pageSchema, problemDetailsSchema } from '@contatos/contracts';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { importJobs } from '@/modules/imports';
import { createImportsRepository } from '@/modules/imports/repository';
import { createDatabase, type Database } from '@/shared/db/client';

import { buildTestApp, registerUser, type TestApp } from '../helpers/app';
import { startMigratedPostgres, truncateAll } from '../helpers/db-container';

let container: StartedPostgreSqlContainer;
let db: Database;
let app: TestApp;
let alice: { id: string; cookie: string };
let bob: { id: string; cookie: string };

const errorsPage = pageSchema(importErrorSchema);

/** Linhas 3 e 4 inválidas; a 4 traz uma fórmula no nome (T-INT17). */
const CSV = [
  'nome;email;celular;telefone',
  'Válida;valida@x.com;(81) 99999-0001;',
  'A;joao@;8133330000;',
  '=HYPERLINK("http://x");formula@;81999990002;',
  'Outra Válida;outra@x.com;(81) 99999-0003;',
].join('\n');

beforeAll(async () => {
  container = await startMigratedPostgres();
  db = createDatabase(container.getConnectionUri());
  app = await buildTestApp(db);
});

afterAll(async () => {
  await app.close();
  await db.close();
  await container.stop();
});

beforeEach(async () => {
  await truncateAll(db.orm);
  const [a, b] = [await registerUser(app), await registerUser(app)];
  alice = { id: a.user.id, cookie: a.cookie };
  bob = { id: b.user.id, cookie: b.cookie };
});

const jobs = (now = new Date()) => importJobs({ db: db.orm, now: () => now, retentionDays: 30 });

/** Importação processada pelo job real, como faria o worker. */
async function processed(content: string, ownerId = alice.id): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const { id } = await createImportsRepository(db.orm).insert({
    ownerId,
    fileName: 'contatos.csv',
    fileSha256: createHash('sha256').update(bytes).digest('hex'),
    content: bytes,
  });
  await jobs()['process-import']({ importId: id }, new AbortController().signal);
  return id;
}

const get = (cookie: string, url: string) =>
  app.inject({ method: 'GET', url: `/api/v1/imports${url}`, headers: { cookie } });

describe('GET /imports/:id/errors (RF18)', () => {
  it('lista as linhas rejeitadas na ordem do arquivo, com conteúdo e motivos', async () => {
    const id = await processed(CSV);

    const response = await get(alice.cookie, `/${id}/errors`);

    expect(response.statusCode).toBe(200);
    const page = errorsPage.parse(response.json());
    expect(page.meta).toEqual({ page: 1, pageSize: 20, total: 2, totalPages: 1 });
    expect(page.data).toEqual([
      {
        lineNumber: 3,
        raw: { nome: 'A', email: 'joao@', celular: '8133330000', telefone: '' },
        errors: [
          expect.objectContaining({ field: 'nome', code: 'NAME_TOO_SHORT' }),
          expect.objectContaining({ field: 'email', code: 'INVALID_EMAIL' }),
          expect.objectContaining({ field: 'celular', code: 'NOT_A_MOBILE_NUMBER' }),
        ],
      },
      {
        lineNumber: 4,
        raw: expect.objectContaining({ nome: '=HYPERLINK("http://x")' }),
        errors: [expect.objectContaining({ field: 'email', code: 'INVALID_EMAIL' })],
      },
    ]);
  });

  it('pagina pela ordem das linhas', async () => {
    const id = await processed(CSV);

    const second = errorsPage.parse(
      (await get(alice.cookie, `/${id}/errors?page=2&pageSize=1`)).json(),
    );

    expect(second.data.map(({ lineNumber }) => lineNumber)).toEqual([4]);
    expect(second.meta).toMatchObject({ total: 2, totalPages: 2 });
  });

  it('depois do expurgo (RN15), raw nulo com rawPurged e motivos preservados (UC14 FA1)', async () => {
    const id = await processed(CSV);
    const in31Days = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    await jobs(in31Days)['purge-retention']({}, new AbortController().signal);

    const page = errorsPage.parse((await get(alice.cookie, `/${id}/errors`)).json());

    expect(page.data.map(({ raw, rawPurged }) => ({ raw, rawPurged }))).toEqual([
      { raw: null, rawPurged: true },
      { raw: null, rawPurged: true },
    ]);
    expect(page.data[0]?.errors).toHaveLength(3);
  });

  it('dado pageSize acima de 100, então 400', async () => {
    const id = await processed(CSV);

    expect((await get(alice.cookie, `/${id}/errors?pageSize=101`)).statusCode).toBe(400);
  });
});

describe('GET /imports/:id/errors.csv (RF19, T-INT17)', () => {
  it('baixa como anexo, com coluna motivo e fórmulas neutralizadas', async () => {
    const id = await processed(CSV);

    const response = await get(alice.cookie, `/${id}/errors.csv`);

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="erros-importacao-${id}.csv"`,
    );
    expect(response.body.split('\r\n')).toEqual([
      '﻿linha;nome;email;celular;telefone;motivo',
      '3;A;joao@;8133330000;;nome: O nome deve ter ao menos 2 caracteres. | email: Informe um e-mail válido. | celular: Informe um número de celular válido.',
      `4;"'=HYPERLINK(""http://x"")";formula@;81999990002;;email: Informe um e-mail válido.`,
      '',
    ]);
  });

  it('dada importação sem erros, então só o cabeçalho', async () => {
    const id = await processed('nome,email,celular\nAna,ana@x.com,(81) 99999-0009\n');

    const response = await get(alice.cookie, `/${id}/errors.csv`);

    expect(response.body).toBe('﻿linha;nome;email;celular;telefone;motivo\r\n');
  });

  it('exporta todas as linhas mesmo acima do tamanho do bloco de leitura', async () => {
    const lines = Array.from(
      { length: 1_205 },
      (_, i) => `Pessoa ${i};invalido-${i};8199999${String(i).padStart(4, '0')};`,
    );
    const id = await processed(['nome;email;celular;telefone', ...lines].join('\n'));

    const response = await get(alice.cookie, `/${id}/errors.csv`);

    const rows = response.body.split('\r\n').filter(Boolean);
    expect(rows).toHaveLength(1 + 1_205);
    expect(rows.at(-1)).toMatch(/^1206;Pessoa 1204;/);
  });
});

describe('isolamento (RN06)', () => {
  it.each(['/errors', '/errors.csv'])('importação de outro usuário: %s → 404', async (suffix) => {
    const id = await processed(CSV);

    const response = await get(bob.cookie, `/${id}${suffix}`);

    expect(response.statusCode).toBe(404);
    expect(problemDetailsSchema.parse(response.json())).toMatchObject({ code: 'NOT_FOUND' });
  });

  it.each(['/nao-e-uuid/errors', '/nao-e-uuid/errors.csv'])('%s → 404', async (url) => {
    expect((await get(alice.cookie, url)).statusCode).toBe(404);
  });
});
