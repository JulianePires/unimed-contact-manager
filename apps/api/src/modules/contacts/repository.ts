import type { ListContactsQuery } from '@contatos/contracts';
import { and, asc, count, desc, eq, isNotNull, isNull, or, type SQL, sql } from 'drizzle-orm';

import { isUniqueViolation } from '@/shared/db/errors';
import { single } from '@/shared/db/rows';
import { type Contact, contacts, type NewContact } from '@/shared/db/schema';
import type { Executor } from '@/shared/db/transaction';

import { ANONYMIZED_NAME, type SearchIntent, parseSearchIntent } from './domain/contact';
import type { ConflictingContact } from './domain/errors';

export interface ContactWritten {
  outcome: 'written';
  contact: Contact;
}

export interface MobileConflict {
  outcome: 'mobile-conflict';
  conflictingContact: ConflictingContact | undefined;
}

export type ContactWrite = ContactWritten | MobileConflict | { outcome: 'not-matched' };

export interface ContactChanges {
  name?: string | undefined;
  email?: string | undefined;
  mobileE164?: string | undefined;
  phoneE164?: string | null | undefined;
}

const writtenOrNotMatched = (contact: Contact | undefined): ContactWrite =>
  contact ? { outcome: 'written', contact } : { outcome: 'not-matched' };

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

  /**
   * A unicidade é garantida pela constraint (ADR-001): nada de consulta antes da escrita. Só após
   * a violação de `contacts_owner_mobile_uq` o contato conflitante é buscado para o 409.
   */
  async function guardingMobile<T>(
    ownerId: string,
    mobileE164: string,
    write: () => Promise<T>,
  ): Promise<T | MobileConflict> {
    try {
      return await write();
    } catch (error) {
      if (!isUniqueViolation(error, 'contacts_owner_mobile_uq')) throw error;
      return {
        outcome: 'mobile-conflict',
        conflictingContact: await findByMobile(ownerId, mobileE164),
      };
    }
  }

  const byId = (ownerId: string, id: string) => and(ownedBy(ownerId), eq(contacts.id, id));

  return {
    insert(contact: NewContact & { mobileE164: string }): Promise<ContactWritten | MobileConflict> {
      return guardingMobile(contact.ownerId, contact.mobileE164, async () => ({
        outcome: 'written' as const,
        contact: single(await db.insert(contacts).values(contact).returning()),
      }));
    },

    /**
     * Importação em lote (ADR-002): a mesma constraint do cadastro decide. Celular já existente na
     * agenda, ativo ou inativo, é ignorado sem erro e sem alterar o contato (RN11).
     * Devolve quantos foram inseridos; os demais do lote foram ignorados.
     */
    async insertIgnoringExisting(rows: (NewContact & { mobileE164: string })[]): Promise<number> {
      if (rows.length === 0) return 0;
      const inserted = await db
        .insert(contacts)
        .values(rows)
        .onConflictDoNothing({ target: [contacts.ownerId, contacts.mobileE164] })
        .returning({ id: contacts.id });
      return inserted.length;
    },

    /** Edição otimista (ADR-004): só aplica se a versão ainda for a lida, e a incrementa. */
    async update(
      ownerId: string,
      id: string,
      expectedVersion: number,
      changes: ContactChanges,
    ): Promise<ContactWrite> {
      const write = async (): Promise<ContactWrite> => {
        const [updated] = await db
          .update(contacts)
          .set({ ...changes, version: sql`${contacts.version} + 1`, updatedAt: sql`now()` })
          .where(and(byId(ownerId, id), eq(contacts.version, expectedVersion)))
          .returning();
        return writtenOrNotMatched(updated);
      };
      return changes.mobileE164 === undefined
        ? write()
        : guardingMobile(ownerId, changes.mobileE164, write);
    },

    /** Transição de status; `undefined` quando já estava no estado pedido (ou não existe). */
    async setDeactivated(
      ownerId: string,
      id: string,
      deactivated: boolean,
    ): Promise<Contact | undefined> {
      const [updated] = await db
        .update(contacts)
        .set({ deactivatedAt: deactivated ? sql`now()` : null, updatedAt: sql`now()` })
        .where(
          and(
            byId(ownerId, id),
            deactivated ? isNull(contacts.deactivatedAt) : isNotNull(contacts.deactivatedAt),
          ),
        )
        .returning();
      return updated;
    },

    /** `false` quando o contato não existe para o usuário. */
    async setFavorite(ownerId: string, id: string, isFavorite: boolean): Promise<boolean> {
      const updated = await db
        .update(contacts)
        .set({ isFavorite })
        .where(byId(ownerId, id))
        .returning({ id: contacts.id });
      return updated.length > 0;
    },

    /**
     * Eliminação LGPD (ADR-009): só de inativo; nome vira marcador, contatos ficam nulos (o celular
     * é liberado, pois NULLs são distintos no UNIQUE) e `anonymized_at` é preenchido.
     */
    async anonymize(ownerId: string, id: string): Promise<boolean> {
      const updated = await db
        .update(contacts)
        .set({
          name: ANONYMIZED_NAME,
          email: null,
          mobileE164: null,
          phoneE164: null,
          isFavorite: false,
          anonymizedAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(and(byId(ownerId, id), isNotNull(contacts.deactivatedAt)))
        .returning({ id: contacts.id });
      return updated.length > 0;
    },

    async findById(ownerId: string, id: string): Promise<Contact | undefined> {
      const [contact] = await db.select().from(contacts).where(byId(ownerId, id));
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
