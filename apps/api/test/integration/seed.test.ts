import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { and, count, eq, isNotNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DEMO_EMAIL, DEMO_SECRET, seedDemo } from '@/demo-seed';
import { createDatabase, type Database } from '@/shared/db/client';
import { contacts, importErrors, imports, users } from '@/shared/db/schema';

import { buildTestApp, CSRF_HEADERS, type TestApp } from '../helpers/app';
import { startMigratedPostgres, truncateAll } from '../helpers/db-container';

let container: StartedPostgreSqlContainer;
let db: Database;
let app: TestApp;

beforeAll(async () => {
  container = await startMigratedPostgres();
  db = createDatabase(container.getConnectionUri());
  app = await buildTestApp(db);
});

beforeEach(() => truncateAll(db.orm));

afterAll(async () => {
  await app.close();
  await db.close();
  await container.stop();
});

async function demoCounts() {
  const [owner] = await db.orm.select().from(users).where(eq(users.email, DEMO_EMAIL));
  const ownerId = owner?.id ?? '';
  const total = async (condition = eq(contacts.ownerId, ownerId)) =>
    (await db.orm.select({ value: count() }).from(contacts).where(condition))[0]?.value;
  return {
    users: (await db.orm.select({ value: count() }).from(users))[0]?.value,
    contacts: await total(),
    inactive: await total(and(eq(contacts.ownerId, ownerId), isNotNull(contacts.deactivatedAt))),
    favorites: await total(and(eq(contacts.ownerId, ownerId), eq(contacts.isFavorite, true))),
    imports: (await db.orm.select({ value: count() }).from(imports))[0]?.value,
    importErrors: (await db.orm.select({ value: count() }).from(importErrors))[0]?.value,
  };
}

async function loginDemo(): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: CSRF_HEADERS,
    payload: { email: DEMO_EMAIL, password: DEMO_SECRET },
  });
  expect(response.statusCode).toBe(200);
  const [cookie] = response.cookies;
  return `${cookie?.name ?? ''}=${cookie?.value ?? ''}`;
}

describe('seed de avaliação (db:seed)', () => {
  it('cria a conta demo, ~30 contatos variados e uma importação concluída com erros', async () => {
    const result = await seedDemo(db.orm);

    expect(result).toEqual({ userCreated: true, contactsCreated: 30, importCreated: true });
    expect(await demoCounts()).toEqual({
      users: 1,
      contacts: 30,
      inactive: 5,
      favorites: 7,
      imports: 1,
      importErrors: 3,
    });
  });

  it('a conta demo entra pela API e vê os dados de avaliação', async () => {
    await seedDemo(db.orm);
    const cookie = await loginDemo();

    const list = await app.inject({ method: 'GET', url: '/api/v1/contacts', headers: { cookie } });
    const history = await app.inject({
      method: 'GET',
      url: '/api/v1/imports',
      headers: { cookie },
    });

    expect(list.json()).toMatchObject({ meta: { total: 25 } });
    expect(history.json()).toMatchObject({
      data: [{ fileName: 'contatos-demo.csv', status: 'COMPLETED_WITH_ERRORS', failedCount: 3 }],
    });
    const [demoImport] = history.json<{ data: { id: string }[] }>().data;
    const errors = await app.inject({
      method: 'GET',
      url: `/api/v1/imports/${demoImport?.id ?? ''}/errors`,
      headers: { cookie },
    });
    expect(errors.json()).toMatchObject({ meta: { total: 3 } });
  });

  it('é idempotente: rodar de novo não duplica nada', async () => {
    await seedDemo(db.orm);
    const before = await demoCounts();

    const again = await seedDemo(db.orm);

    expect(again).toEqual({ userCreated: false, contactsCreated: 0, importCreated: false });
    expect(await demoCounts()).toEqual(before);
  });

  it('não sobrescreve o que foi alterado na demo e repõe contatos apagados', async () => {
    await seedDemo(db.orm);
    await db.orm.update(contacts).set({ isFavorite: false });
    await db.orm.delete(contacts).where(eq(contacts.name, 'Vítor Hugo'));

    const again = await seedDemo(db.orm);

    expect(again.contactsCreated).toBe(1);
    expect(await demoCounts()).toMatchObject({ contacts: 30, favorites: 0 });
  });
});
