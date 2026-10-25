import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type Database } from '@/shared/db/client';
import { contacts, type User } from '@/shared/db/schema';

import { startMigratedPostgres, truncateAll } from '../helpers/db-container';
import { buildContact, createContact, createUser } from '../helpers/factories';

let container: StartedPostgreSqlContainer;
let db: Database;
let owner: User;

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

const violation = (code: string, constraint: string) => ({ cause: { code, constraint } });
const uniqueViolation = violation('23505', 'contacts_owner_mobile_uq');
const piiViolation = violation('23514', 'contacts_pii_chk');

function anonymize(id: string) {
  return db.orm
    .update(contacts)
    .set({
      name: 'Contato removido',
      email: null,
      mobileE164: null,
      phoneE164: null,
      anonymizedAt: new Date(),
    })
    .where(eq(contacts.id, id));
}

describe('contacts_owner_mobile_uq (ADR-001)', () => {
  it('dado um contato ativo, quando o mesmo dono cadastra o mesmo celular, então rejeita', async () => {
    const existing = await createContact(db.orm, owner.id);

    const duplicate = db.orm
      .insert(contacts)
      .values(buildContact(owner.id, { mobileE164: existing.mobileE164 }));

    await expect(duplicate).rejects.toMatchObject(uniqueViolation);
  });

  it('dado um contato inativo, quando o mesmo dono cadastra o mesmo celular, então rejeita', async () => {
    const inactive = await createContact(db.orm, owner.id, { deactivatedAt: new Date() });

    const duplicate = db.orm
      .insert(contacts)
      .values(buildContact(owner.id, { mobileE164: inactive.mobileE164 }));

    await expect(duplicate).rejects.toMatchObject(uniqueViolation);
  });

  it('dado um celular em uso, quando outro dono cadastra o mesmo celular, então aceita', async () => {
    const existing = await createContact(db.orm, owner.id);
    const otherOwner = await createUser(db.orm);

    const contact = await createContact(db.orm, otherOwner.id, {
      mobileE164: existing.mobileE164,
    });

    expect(contact.mobileE164).toBe(existing.mobileE164);
  });

  it('dado um contato anonimizado, quando o dono recadastra o celular liberado, então aceita', async () => {
    const anonymized = await createContact(db.orm, owner.id, { deactivatedAt: new Date() });
    await anonymize(anonymized.id);
    const second = await createContact(db.orm, owner.id, { mobileE164: anonymized.mobileE164 });
    await anonymize(second.id);

    const contact = await createContact(db.orm, owner.id, { mobileE164: anonymized.mobileE164 });

    expect(contact.mobileE164).toBe(anonymized.mobileE164);
  });
});

describe('contacts_pii_chk (ADR-009)', () => {
  it.each([
    ['sem e-mail', { email: null }],
    ['sem celular', { mobileE164: null }],
  ])('dado um contato não anonimizado %s, quando persiste, então rejeita', async (_, overrides) => {
    const contact = db.orm.insert(contacts).values(buildContact(owner.id, overrides));

    await expect(contact).rejects.toMatchObject(piiViolation);
  });

  it('dado um contato anonimizado sem e-mail e celular, quando persiste, então aceita', async () => {
    const contact = await createContact(db.orm, owner.id, {
      email: null,
      mobileE164: null,
      anonymizedAt: new Date(),
    });

    expect(contact.anonymizedAt).toBeInstanceOf(Date);
  });
});

describe('contacts: identidade e versão (ADR-004)', () => {
  it('dado um novo contato, quando persiste, então recebe UUID v7 e versão 1', async () => {
    const contact = await createContact(db.orm, owner.id);

    expect(contact.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(contact.version).toBe(1);
  });
});

describe('f_unaccent (ADR-005)', () => {
  it.each([
    ["f_unaccent(lower('José'))", 'jose'],
    ["f_unaccent('José')", 'Jose'],
    ["f_unaccent(lower('JOÃO Conceição'))", 'joao conceicao'],
  ])('%s = %s', async (expression, expected) => {
    const { rows } = await db.orm.execute<{ value: string }>(
      sql`SELECT ${sql.raw(expression)} AS value`,
    );

    expect(rows[0]?.value).toBe(expected);
  });

  it('é IMMUTABLE, permitindo o uso em índice', async () => {
    const { rows } = await db.orm.execute<{ volatility: string }>(
      sql`SELECT provolatile AS volatility FROM pg_proc WHERE proname = 'f_unaccent'`,
    );

    expect(rows).toEqual([{ volatility: 'i' }]);
  });
});

describe('índices (docs/03 §3.5)', () => {
  it('a migration cria os índices de listagem, busca e importação', async () => {
    const { rows } = await db.orm.execute<{ name: string }>(
      sql`SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public'`,
    );

    expect(rows.map((row) => row.name)).toEqual(
      expect.arrayContaining([
        'contacts_owner_mobile_uq',
        'contacts_list_idx',
        'contacts_name_trgm',
        'contacts_email_trgm',
        'contacts_mobile_trgm',
        'imports_owner_hash_idx',
        'import_errors_import_line_idx',
      ]),
    );
  });
});
