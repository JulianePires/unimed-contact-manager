import type { ListContactsQuery } from '@contatos/contracts';
import { and, asc, count, desc, eq, isNotNull, isNull, or, type SQL, sql } from 'drizzle-orm';

import { isUniqueViolation } from '@/shared/db/errors';
import { single } from '@/shared/db/rows';
import { type Contact, contacts, type NewContact } from '@/shared/db/schema';
import type { Executor } from '@/shared/db/transaction';

import { type SearchIntent, parseSearchIntent } from './domain/contact';
import type { ConflictingContact } from './domain/errors';

export type InsertContactResult =
  | { ok: true; contact: Contact }
  | { ok: false; conflictingContact: ConflictingContact | undefined };

/** Curingas do LIKE no termo digitado são literais: `50%` não vira "qualquer coisa". */
function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * Condição da busca com as mesmas expressões dos índices GIN trigram da migration
 * (`contacts_name_trgm`, `contacts_email_trgm`, `contacts_mobile_trgm`), para que sejam usados.
 */
export function searchCondition(intent: SearchIntent): SQL | undefined {
  if (intent.kind === 'mobile') {
    return sql`${contacts.mobileE164} LIKE ${containsPattern(intent.digits)}`;
  }
  const pattern = containsPattern(intent.term);
  const byEmail = sql`(${contacts.email}::text) ILIKE ${pattern}`;
  if (intent.kind === 'email') return byEmail;
  return or(sql`f_unaccent(lower(${contacts.name})) ILIKE f_unaccent(lower(${pattern}))`, byEmail);
}

const STATUS_CONDITION = {
  active: isNull(contacts.deactivatedAt),
  inactive: isNotNull(contacts.deactivatedAt),
  all: undefined,
} as const;

/** Ordenação determinística: o `id` desempata no mesmo sentido do campo (ADR-004). */
const ORDER_BY = {
  name: [asc(contacts.name), asc(contacts.id)],
  '-name': [desc(contacts.name), desc(contacts.id)],
  createdAt: [asc(contacts.createdAt), asc(contacts.id)],
  '-createdAt': [desc(contacts.createdAt), desc(contacts.id)],
} as const;

export function createContactsRepository(db: Executor) {
  const ownedBy = (ownerId: string) =>
    and(eq(contacts.ownerId, ownerId), isNull(contacts.anonymizedAt));

  async function findByMobile(
    ownerId: string,
    mobileE164: string,
  ): Promise<ConflictingContact | undefined> {
    const [existing] = await db
      .select({ id: contacts.id, deactivatedAt: contacts.deactivatedAt })
      .from(contacts)
      .where(and(eq(contacts.ownerId, ownerId), eq(contacts.mobileE164, mobileE164)));
    return existing;
  }

  return {
    /**
     * A unicidade é garantida pela constraint (ADR-001): nada de consulta antes do INSERT. Só após
     * a violação de `contacts_owner_mobile_uq` o contato conflitante é buscado para o 409.
     */
    async insert(contact: NewContact & { mobileE164: string }): Promise<InsertContactResult> {
      try {
        return { ok: true, contact: single(await db.insert(contacts).values(contact).returning()) };
      } catch (error) {
        if (!isUniqueViolation(error, 'contacts_owner_mobile_uq')) throw error;
        return {
          ok: false,
          conflictingContact: await findByMobile(contact.ownerId, contact.mobileE164),
        };
      }
    },

    async findById(ownerId: string, id: string): Promise<Contact | undefined> {
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(ownedBy(ownerId), eq(contacts.id, id)));
      return contact;
    },

    async list(
      ownerId: string,
      query: ListContactsQuery,
    ): Promise<{ contacts: Contact[]; total: number }> {
      const intent = parseSearchIntent(query.q);
      const where = and(
        ownedBy(ownerId),
        STATUS_CONDITION[query.status],
        query.favorite === undefined ? undefined : eq(contacts.isFavorite, query.favorite),
        intent ? searchCondition(intent) : undefined,
      );
      const [rows, totals] = await Promise.all([
        db
          .select()
          .from(contacts)
          .where(where)
          .orderBy(...ORDER_BY[query.sort])
          .limit(query.pageSize)
          .offset((query.page - 1) * query.pageSize),
        db.select({ total: count() }).from(contacts).where(where),
      ]);
      return { contacts: rows, total: single(totals).total };
    },
  };
}

export type ContactsRepository = ReturnType<typeof createContactsRepository>;
