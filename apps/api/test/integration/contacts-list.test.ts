import { type Contact, contactSchema, pageSchema, problemDetailsSchema } from '@contatos/contracts';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { parseSearchIntent } from '@/modules/contacts/domain/contact';
import { searchCondition } from '@/modules/contacts/repository';
import { createDatabase, type Database } from '@/shared/db/client';
import { contacts, type NewContact } from '@/shared/db/schema';

import { buildTestApp, registerUser, type TestApp } from '../helpers/app';
import { startMigratedPostgres, truncateAll } from '../helpers/db-container';
import { buildContact } from '../helpers/factories';

let container: StartedPostgreSqlContainer;
let db: Database;
let app: TestApp;
let cookie: string;
let ownerId: string;

const contactPage = pageSchema(contactSchema);

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
  const registered = await registerUser(app);
  cookie = registered.cookie;
  ownerId = registered.user.id;
});

async function list(query: Record<string, string> = {}) {
  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/contacts',
    query,
    headers: { cookie },
  });
  expect(response.statusCode).toBe(200);
  return contactPage.parse(response.json());
}

const insert = (rows: Partial<NewContact>[]) =>
  db.orm.insert(contacts).values(rows.map((row) => buildContact(ownerId, row)));

const names = (page: { data: Contact[] }) => page.data.map((contact) => contact.name);

describe('paginação e ordenação (T-INT06, ADR-004)', () => {
  const NAMES = ['Carla', 'Ana', 'Bruno'];

  beforeEach(async () => {
    // Um único INSERT: mesmo created_at para todos, o desempate depende só do id
    await insert(Array.from({ length: 15 }, () => NAMES.map((name) => ({ name }))).flat());
  });

  async function allPages(query: Record<string, string>) {
    const pages = [];
    for (let page = 1; page <= 3; page += 1) {
      pages.push(await list({ ...query, page: String(page), pageSize: '20' }));
    }
    return pages;
  }

  it.each([
    ['name', (a: Contact, b: Contact) => a.name.localeCompare(b.name) || cmp(a.id, b.id)],
    ['-name', (a: Contact, b: Contact) => b.name.localeCompare(a.name) || cmp(b.id, a.id)],
    ['createdAt', (a: Contact, b: Contact) => cmp(a.id, b.id)],
    ['-createdAt', (a: Contact, b: Contact) => cmp(b.id, a.id)],
  ])('sort=%s: páginas sem repetição nem omissão, desempate por id', async (sort, order) => {
    const pages = await allPages({ sort });

    const ids = pages.flatMap((page) => page.data.map((contact) => contact.id));
    expect(new Set(ids).size).toBe(45);
    const expected = pages.flatMap((page) => page.data).sort(order);
    expect(ids).toEqual(expected.map((contact) => contact.id));
    expect(pages.map((page) => page.data.length)).toEqual([20, 20, 5]);
    expect(pages[0]?.meta).toEqual({ page: 1, pageSize: 20, total: 45, totalPages: 3 });
  });

  it('dada a mesma consulta repetida, então a ordem é idêntica', async () => {
    expect(await allPages({ sort: 'name' })).toEqual(await allPages({ sort: 'name' }));
  });

  it('dada página além do fim, então lista vazia com o total correto', async () => {
    const page = await list({ page: '4', pageSize: '20' });

    expect(page.data).toEqual([]);
    expect(page.meta).toEqual({ page: 4, pageSize: 20, total: 45, totalPages: 3 });
  });

  it('dados os padrões, então página 1 com 20 itens ordenados por nome', async () => {
    const page = await list();

    expect(page.meta).toMatchObject({ page: 1, pageSize: 20 });
    expect(names(page)).toEqual([...Array(15).fill('Ana'), ...Array(5).fill('Bruno')]);
  });
});

function cmp(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

describe('busca (T-INT07, ADR-005)', () => {
  beforeEach(async () => {
    await insert([
      { name: 'José da Silva', email: 'jose.silva@exemplo.com' },
      { name: 'Joana Prado', email: 'joana@exemplo.com' },
      { name: 'Maria Souza', email: 'maria@exemplo.com', mobileE164: '+5581998765432' },
      { name: 'Ana Lima', email: 'ana@empresa.com.br' },
      { name: 'Promoção 50%', email: 'promo@exemplo.com' },
    ]);
  });

  it.each([
    ['jose', ['José da Silva']],
    ['JOSÉ', ['José da Silva']],
    ['silva', ['José da Silva']],
    ['99876', ['Maria Souza']],
    ['(81) 99876-5432', ['Maria Souza']],
    ['+55 81 9987', ['Maria Souza']],
    ['@empresa', ['Ana Lima']],
    ['joana@', ['Joana Prado']],
    ['50%', ['Promoção 50%']],
    ['o_a', []],
  ])('q=%s encontra %o', async (q, expected) => {
    expect(names(await list({ q }))).toEqual(expected);
  });

  it('dado termo de 1 caractere, então não filtra', async () => {
    expect((await list({ q: 'j' })).meta.total).toBe(5);
  });

  it.each([
    ['jose', ['contacts_name_trgm', 'contacts_email_trgm']],
    ['@empresa', ['contacts_email_trgm']],
    ['99876', ['contacts_mobile_trgm']],
  ])('q=%s usa os índices GIN %o (EXPLAIN)', async (q, indexes) => {
    const intent = parseSearchIntent(q);
    if (!intent) throw new Error('termo deveria buscar');
    const query = db.orm
      .select({ id: contacts.id })
      .from(contacts)
      .where(searchCondition(intent))
      .toSQL();
    const client = await db.orm.$client.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL enable_seqscan = off');
      const { rows } = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN ${query.sql}`,
        query.params,
      );
      const plan = rows.map((row) => row['QUERY PLAN']).join('\n');
      for (const index of indexes) expect(plan).toContain(index);
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  });
});

describe('filtros status × favorito (T-INT08)', () => {
  beforeEach(async () => {
    const deactivatedAt = new Date('2026-10-20T12:00:00.000Z');
    await insert([
      { name: 'Ativo favorito', isFavorite: true },
      { name: 'Ativo comum' },
      { name: 'Inativo favorito', isFavorite: true, deactivatedAt },
      { name: 'Inativo comum', deactivatedAt },
      {
        name: 'Eliminado',
        email: null,
        mobileE164: null,
        deactivatedAt,
        anonymizedAt: deactivatedAt,
      },
    ]);
  });

  it.each([
    [{}, ['Ativo comum', 'Ativo favorito']],
    [{ status: 'inactive' }, ['Inativo comum', 'Inativo favorito']],
    [{ status: 'all' }, ['Ativo comum', 'Ativo favorito', 'Inativo comum', 'Inativo favorito']],
    [{ favorite: 'true' }, ['Ativo favorito']],
    [{ favorite: 'false' }, ['Ativo comum']],
    [{ status: 'inactive', favorite: 'true' }, ['Inativo favorito']],
    [{ status: 'all', favorite: 'true' }, ['Ativo favorito', 'Inativo favorito']],
  ])('%o → %o (eliminados nunca aparecem)', async (query, expected) => {
    expect(names(await list(query))).toEqual(expected);
  });
});

describe('isolamento e validação da query', () => {
  it('não lista contatos de outro usuário (RN06)', async () => {
    const other = await registerUser(app);
    await db.orm.insert(contacts).values(buildContact(other.user.id, { name: 'Alheio' }));
    await insert([{ name: 'Meu' }]);

    expect(names(await list({ status: 'all' }))).toEqual(['Meu']);
  });

  it.each([{ pageSize: '101' }, { page: '0' }, { sort: 'email' }, { status: 'deleted' }])(
    'dado %o, então 400 BAD_REQUEST',
    async (query) => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/contacts',
        query,
        headers: { cookie },
      });

      expect(response.statusCode).toBe(400);
      expect(problemDetailsSchema.parse(response.json())).toMatchObject({ code: 'BAD_REQUEST' });
    },
  );

  it('dado contato eliminado do próprio usuário, então nunca aparece', async () => {
    const [mine] = await insert([{ name: 'Será eliminado' }]).returning();
    await db.orm
      .update(contacts)
      .set({ email: null, mobileE164: null, anonymizedAt: new Date() })
      .where(eq(contacts.id, mine?.id ?? ''));

    expect((await list({ status: 'all' })).meta.total).toBe(0);
  });
});
