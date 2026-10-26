import { type Contact, contactSchema, problemDetailsSchema } from '@contatos/contracts';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type Database } from '@/shared/db/client';
import { contacts } from '@/shared/db/schema';

import { buildTestApp, CSRF_HEADERS, registerUser, type TestApp } from '../helpers/app';
import { startMigratedPostgres, truncateAll } from '../helpers/db-container';

let container: StartedPostgreSqlContainer;
let db: Database;
let app: TestApp;
let alice: string;
let bob: string;

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
  alice = (await registerUser(app)).cookie;
  bob = (await registerUser(app)).cookie;
});

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function call(
  cookie: string,
  method: Method,
  url: string,
  options: { payload?: object; ifMatch?: string } = {},
) {
  return app.inject({
    method,
    url: `/api/v1/contacts${url}`,
    headers: {
      ...CSRF_HEADERS,
      cookie,
      ...(options.ifMatch !== undefined && { 'if-match': options.ifMatch }),
    },
    ...(options.payload && { payload: options.payload }),
  });
}

const problemOf = (body: string) => problemDetailsSchema.parse(JSON.parse(body));

async function createContact(mobile = '(81) 99876-5432'): Promise<Contact> {
  const response = await call(alice, 'POST', '', {
    payload: { name: 'Maria Silva', email: 'maria@empresa.com', mobile, phone: '81 3333-0000' },
  });
  expect(response.statusCode).toBe(201);
  return contactSchema.parse(response.json());
}

async function deactivated(contact: Contact): Promise<Contact> {
  const response = await call(alice, 'POST', `/${contact.id}/deactivate`);
  expect(response.statusCode).toBe(200);
  return contactSchema.parse(response.json());
}

describe('PATCH /contacts/:id com If-Match (T-INT09, RN07, ADR-004)', () => {
  it('dado o ETag lido, então 200 com a versão incrementada e novo ETag', async () => {
    const contact = await createContact();
    const read = await call(alice, 'GET', `/${contact.id}`);
    expect(read.headers.etag).toBe('"v1"');

    const response = await call(alice, 'PATCH', `/${contact.id}`, {
      ifMatch: String(read.headers.etag),
      payload: { name: 'Maria Souza', phone: null },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers.etag).toBe('"v2"');
    expect(contactSchema.parse(response.json())).toMatchObject({
      name: 'Maria Souza',
      phone: null,
      phoneFormatted: null,
      mobile: '+5581998765432',
      version: 2,
    });
  });

  it('dados dois PATCH com a mesma versão, então 200 e 412, sem sobrescrever a primeira edição', async () => {
    const contact = await createContact();

    const first = await call(alice, 'PATCH', `/${contact.id}`, {
      ifMatch: '"v1"',
      payload: { name: 'Edição da aba 1' },
    });
    const second = await call(alice, 'PATCH', `/${contact.id}`, {
      ifMatch: '"v1"',
      payload: { name: 'Edição da aba 2' },
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(412);
    expect(problemOf(second.body)).toMatchObject({ code: 'CONTACT_MODIFIED' });
    const current = await call(alice, 'GET', `/${contact.id}`);
    expect(current.json()).toMatchObject({ name: 'Edição da aba 1', version: 2 });
  });

  it('dados dois PATCH simultâneos com a mesma versão, então exatamente um vence', async () => {
    const contact = await createContact();

    const responses = await Promise.all(
      ['A', 'B'].map((tab) =>
        call(alice, 'PATCH', `/${contact.id}`, {
          ifMatch: '"v1"',
          payload: { name: `Aba ${tab}` },
        }),
      ),
    );

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 412]);
  });

  it('dado PATCH sem If-Match, então 428 PRECONDITION_REQUIRED', async () => {
    const contact = await createContact();

    const response = await call(alice, 'PATCH', `/${contact.id}`, {
      payload: { name: 'Sem versão' },
    });

    expect(response.statusCode).toBe(428);
    expect(problemOf(response.body)).toMatchObject({ code: 'PRECONDITION_REQUIRED' });
  });

  it.each(['"v0"', '*', 'W/"v1"', 'lixo'])('dado If-Match %s, então 412', async (ifMatch) => {
    const contact = await createContact();

    const response = await call(alice, 'PATCH', `/${contact.id}`, {
      ifMatch,
      payload: { name: 'Outro nome' },
    });

    expect(response.statusCode).toBe(412);
  });

  it('dado celular de outro contato inativo, então 409 com o id dele (UC07 FA)', async () => {
    const inactive = await deactivated(await createContact('81988887777'));
    const contact = await createContact();

    const response = await call(alice, 'PATCH', `/${contact.id}`, {
      ifMatch: '"v1"',
      payload: { mobile: '(81) 98888-7777' },
    });

    expect(response.statusCode).toBe(409);
    expect(problemOf(response.body)).toMatchObject({
      code: 'MOBILE_BELONGS_TO_INACTIVE_CONTACT',
      contactId: inactive.id,
    });
  });

  it('dado novo celular livre, então normaliza e grava', async () => {
    const contact = await createContact();

    const response = await call(alice, 'PATCH', `/${contact.id}`, {
      ifMatch: '"v1"',
      payload: { mobile: '+55 81 98888-7777' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ mobile: '+5581988887777', version: 2 });
  });

  it.each([
    ['status', { name: 'Maria', status: 'inactive' }],
    ['favorito', { name: 'Maria', isFavorite: true }],
  ])('dado %s no corpo, então 422 UNKNOWN_FIELD', async (_, payload) => {
    const contact = await createContact();

    const response = await call(alice, 'PATCH', `/${contact.id}`, { ifMatch: '"v1"', payload });

    expect(response.statusCode).toBe(422);
    expect(problemOf(response.body).errors).toEqual([
      expect.objectContaining({ code: 'UNKNOWN_FIELD' }),
    ]);
  });
});

describe('favorito e status idempotentes (T-INT10, RN08)', () => {
  it('dado PUT e DELETE /favorite repetidos, então 204 em todos e o mesmo estado final', async () => {
    const contact = await createContact();

    for (const expected of [true, true]) {
      expect((await call(alice, 'PUT', `/${contact.id}/favorite`)).statusCode).toBe(204);
      expect((await call(alice, 'GET', `/${contact.id}`)).json()).toMatchObject({
        isFavorite: expected,
      });
    }
    for (const expected of [false, false]) {
      expect((await call(alice, 'DELETE', `/${contact.id}/favorite`)).statusCode).toBe(204);
      expect((await call(alice, 'GET', `/${contact.id}`)).json()).toMatchObject({
        isFavorite: expected,
      });
    }
  });

  it('dadas duas inativações seguidas, então 200 e 200 com o mesmo deactivatedAt', async () => {
    const contact = await createContact();

    const first = await call(alice, 'POST', `/${contact.id}/deactivate`);
    const second = await call(alice, 'POST', `/${contact.id}/deactivate`);

    expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
    const [a, b] = [contactSchema.parse(first.json()), contactSchema.parse(second.json())];
    expect(a.status).toBe('inactive');
    expect(b).toEqual(a);
  });

  it('dadas duas reativações seguidas, então 200 e 200 com o contato ativo', async () => {
    const contact = await deactivated(await createContact());

    const first = await call(alice, 'POST', `/${contact.id}/reactivate`);
    const second = await call(alice, 'POST', `/${contact.id}/reactivate`);

    expect([first.statusCode, second.statusCode]).toEqual([200, 200]);
    expect(second.json()).toMatchObject({ status: 'active', deactivatedAt: null });
  });

  it('favoritar e mudar status não alteram a versão da edição', async () => {
    const contact = await createContact();

    await call(alice, 'PUT', `/${contact.id}/favorite`);
    await call(alice, 'POST', `/${contact.id}/deactivate`);

    const edit = await call(alice, 'PATCH', `/${contact.id}`, {
      ifMatch: '"v1"',
      payload: { name: 'Ainda v1' },
    });
    expect(edit.statusCode).toBe(200);
  });
});

describe('DELETE /contacts/:id — eliminação LGPD (T-INT15, RN09, ADR-009)', () => {
  it('dado contato ativo, então 409 CONTACT_MUST_BE_INACTIVE e nada muda', async () => {
    const contact = await createContact();

    const response = await call(alice, 'DELETE', `/${contact.id}`);

    expect(response.statusCode).toBe(409);
    expect(problemOf(response.body)).toMatchObject({
      code: 'CONTACT_MUST_BE_INACTIVE',
      contactId: contact.id,
    });
    expect((await call(alice, 'GET', `/${contact.id}`)).json()).toEqual(contact);
  });

  it('dado contato inativo, então 204, dados anonimizados e o celular liberado para novo cadastro', async () => {
    const contact = await deactivated(await createContact());

    const response = await call(alice, 'DELETE', `/${contact.id}`);

    expect(response.statusCode).toBe(204);
    const [stored] = await db.orm.select().from(contacts).where(eq(contacts.id, contact.id));
    expect(stored).toMatchObject({
      name: 'Contato removido',
      email: null,
      mobileE164: null,
      phoneE164: null,
      isFavorite: false,
    });
    expect(stored?.anonymizedAt).toBeInstanceOf(Date);
    const again = await call(alice, 'POST', '', {
      payload: { name: 'Nova pessoa', email: 'nova@empresa.com', mobile: '81998765432' },
    });
    expect(again.statusCode).toBe(201);
  });

  it('dado contato eliminado, então GET, PATCH, reactivate, favorite e novo DELETE respondem 404', async () => {
    const contact = await deactivated(await createContact());
    await call(alice, 'DELETE', `/${contact.id}`);

    const responses = await Promise.all([
      call(alice, 'GET', `/${contact.id}`),
      call(alice, 'PATCH', `/${contact.id}`, { ifMatch: '"v1"', payload: { name: 'Volta' } }),
      call(alice, 'POST', `/${contact.id}/reactivate`),
      call(alice, 'POST', `/${contact.id}/deactivate`),
      call(alice, 'PUT', `/${contact.id}/favorite`),
      call(alice, 'DELETE', `/${contact.id}`),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([
      404, 404, 404, 404, 404, 404,
    ]);
  });
});

describe('isolamento (T-INT05, RN06)', () => {
  it('dado contato de outro usuário, então todas as rotas respondem 404 e nada muda', async () => {
    const contact = await deactivated(await createContact());

    const responses = await Promise.all([
      call(bob, 'PATCH', `/${contact.id}`, { ifMatch: '"v1"', payload: { name: 'Invasor' } }),
      call(bob, 'PUT', `/${contact.id}/favorite`),
      call(bob, 'POST', `/${contact.id}/reactivate`),
      call(bob, 'DELETE', `/${contact.id}`),
    ]);

    expect(responses.map((response) => response.statusCode)).toEqual([404, 404, 404, 404]);
    expect((await call(alice, 'GET', `/${contact.id}`)).json()).toEqual(contact);
  });

  it.each([
    ['PATCH', '/nao-e-uuid'],
    ['DELETE', '/nao-e-uuid'],
    ['PUT', '/nao-e-uuid/favorite'],
    ['POST', '/nao-e-uuid/deactivate'],
  ] as const)('dado %s com id malformado, então 404', async (method, url) => {
    const response = await call(alice, method, url, {
      ifMatch: '"v1"',
      ...(method === 'PATCH' && { payload: { name: 'Xavier' } }),
    });

    expect(response.statusCode).toBe(404);
  });
});
