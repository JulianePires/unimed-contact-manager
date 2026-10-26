import { type Contact, contactSchema, problemDetailsSchema } from '@contatos/contracts';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createContactsRepository } from '@/modules/contacts/repository';
import { createDatabase, type Database } from '@/shared/db/client';
import { contacts } from '@/shared/db/schema';

import { buildTestApp, CSRF_HEADERS, registerUser, type TestApp } from '../helpers/app';
import { startMigratedPostgres, truncateAll } from '../helpers/db-container';

let container: StartedPostgreSqlContainer;
let db: Database;
let app: TestApp;
let alice: string;
let bob: string;

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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

const newContact = (mobile: string, overrides: object = {}) => ({
  name: 'Maria Silva',
  email: 'maria@empresa.com',
  mobile,
  ...overrides,
});

const post = (cookie: string, payload: object) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/contacts',
    headers: { ...CSRF_HEADERS, cookie },
    payload,
  });

const get = (cookie: string, id: string) =>
  app.inject({ method: 'GET', url: `/api/v1/contacts/${id}`, headers: { cookie } });

const problemOf = (body: string) => problemDetailsSchema.parse(JSON.parse(body));

async function created(cookie: string, mobile: string): Promise<Contact> {
  const response = await post(cookie, newContact(mobile));
  expect(response.statusCode).toBe(201);
  return contactSchema.parse(response.json());
}

const rowsWithMobile = (mobileE164: string) =>
  db.orm.select().from(contacts).where(eq(contacts.mobileE164, mobileE164));

describe('POST /contacts (RF05, RN01, RN02)', () => {
  it('T-INT01: dado celular mascarado, então 201 com E.164, versão 1, ETag e Location', async () => {
    const response = await post(
      alice,
      newContact('(81) 99876-5432', { name: '  Maria Silva ', phone: '81 3333-0000' }),
    );

    expect(response.statusCode).toBe(201);
    const contact = contactSchema.parse(response.json());
    expect(contact).toMatchObject({
      name: 'Maria Silva',
      mobile: '+5581998765432',
      mobileFormatted: '(81) 99876-5432',
      phone: '+558133330000',
      phoneFormatted: '(81) 3333-0000',
      isFavorite: false,
      status: 'active',
      deactivatedAt: null,
      version: 1,
    });
    expect(contact.id).toMatch(UUID_V7);
    expect(response.headers.etag).toBe('"v1"');
    expect(response.headers.location).toBe(`/api/v1/contacts/${contact.id}`);
  });

  it('dado telefone fixo no campo celular, então 422 NOT_A_MOBILE_NUMBER', async () => {
    const response = await post(alice, newContact('(81) 3333-0000'));

    expect(response.statusCode).toBe(422);
    expect(problemOf(response.body).errors).toEqual([
      expect.objectContaining({ field: 'mobile', code: 'NOT_A_MOBILE_NUMBER' }),
    ]);
  });

  it('dado status no corpo, então 422 UNKNOWN_FIELD', async () => {
    const response = await post(alice, newContact('81998765432', { status: 'inactive' }));

    expect(response.statusCode).toBe(422);
    expect(problemOf(response.body).errors).toEqual([
      expect.objectContaining({ field: 'status', code: 'UNKNOWN_FIELD' }),
    ]);
  });

  it('dado requisição sem sessão, então 401', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/contacts',
      headers: CSRF_HEADERS,
      payload: newContact('81998765432'),
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('unicidade do celular (ADR-001)', () => {
  it('T-INT02: dado celular de contato ativo, então 409 MOBILE_ALREADY_EXISTS com o id dele', async () => {
    const existing = await created(alice, '(81) 99876-5432');

    const response = await post(alice, newContact('+55 81 99876-5432', { name: 'Outra Pessoa' }));

    expect(response.statusCode).toBe(409);
    expect(problemOf(response.body)).toMatchObject({
      code: 'MOBILE_ALREADY_EXISTS',
      contactId: existing.id,
    });
    expect(await rowsWithMobile('+5581998765432')).toHaveLength(1);
  });

  it('T-INT03: dado celular de contato inativo, então 409 com o id do inativo para reativação', async () => {
    const inactive = await created(alice, '81998765432');
    await db.orm
      .update(contacts)
      .set({ deactivatedAt: new Date() })
      .where(eq(contacts.id, inactive.id));

    const response = await post(alice, newContact('(81) 99876-5432'));

    expect(response.statusCode).toBe(409);
    expect(problemOf(response.body)).toMatchObject({
      code: 'MOBILE_BELONGS_TO_INACTIVE_CONTACT',
      contactId: inactive.id,
    });
  });

  it('dado o mesmo celular na agenda de outro usuário, então cadastra (unicidade por usuário)', async () => {
    await created(alice, '81998765432');

    expect((await post(bob, newContact('81998765432'))).statusCode).toBe(201);
  });

  it('T-INT04: dados 20 POSTs simultâneos com o mesmo celular, então exatamente 1×201 e 19×409', async () => {
    const masks = ['(81) 99876-5432', '81998765432', '+55 81 99876-5432', '081 99876 5432'];

    const responses = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        post(alice, newContact(masks[i % masks.length] ?? '', { name: `Pessoa ${i}` })),
      ),
    );

    const statuses = responses.map((response) => response.statusCode);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(19);
    const [winner] = await rowsWithMobile('+5581998765432');
    expect(await rowsWithMobile('+5581998765432')).toHaveLength(1);
    for (const response of responses.filter((r) => r.statusCode === 409)) {
      expect(problemOf(response.body)).toMatchObject({
        code: 'MOBILE_ALREADY_EXISTS',
        contactId: winner?.id,
      });
    }
  });
});

describe('tradução de erros do banco (T-UB07)', () => {
  it('dada violação de outra constraint, então o erro segue (vira 500), sem virar conflito', async () => {
    const { user } = await registerUser(app);
    const repository = createContactsRepository(db.orm);

    const insert = repository.insert({
      ownerId: user.id,
      name: 'Maria',
      email: null,
      mobileE164: '+5581998765432',
    });

    await expect(insert).rejects.toMatchObject({
      cause: { code: '23514', constraint: 'contacts_pii_chk' },
    });
  });
});

describe('GET /contacts/:id (RN06, RNF04)', () => {
  it('dado contato próprio, então 200 com o ETag da versão', async () => {
    const contact = await created(alice, '81998765432');

    const response = await get(alice, contact.id);

    expect(response.statusCode).toBe(200);
    expect(response.headers.etag).toBe('"v1"');
    expect(response.json()).toEqual(contact);
  });

  it('T-INT05: dado contato de outro usuário, então 404 (não 403)', async () => {
    const contact = await created(alice, '81998765432');

    const response = await get(bob, contact.id);

    expect(response.statusCode).toBe(404);
    expect(problemOf(response.body)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('dado contato eliminado, então 404', async () => {
    const contact = await created(alice, '81998765432');
    await db.orm
      .update(contacts)
      .set({ email: null, mobileE164: null, anonymizedAt: new Date() })
      .where(eq(contacts.id, contact.id));

    expect((await get(alice, contact.id)).statusCode).toBe(404);
  });

  it.each(['nao-e-uuid', '00000000-0000-0000-0000-000000000000'])(
    'dado id %s, então 404',
    async (id) => {
      expect((await get(alice, id)).statusCode).toBe(404);
    },
  );
});
