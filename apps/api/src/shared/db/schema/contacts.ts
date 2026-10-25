import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { v7 as uuidv7 } from 'uuid';

import { citext, createdAt, timestamptz } from './columns';
import { users } from './users';

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id')
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    name: varchar('name', { length: 120 }).notNull(),
    email: citext('email'),
    mobileE164: varchar('mobile_e164', { length: 16 }),
    phoneE164: varchar('phone_e164', { length: 16 }),
    isFavorite: boolean('is_favorite').notNull().default(false),
    deactivatedAt: timestamptz('deactivated_at'),
    anonymizedAt: timestamptz('anonymized_at'),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    unique('contacts_owner_mobile_uq').on(t.ownerId, t.mobileE164),
    check(
      'contacts_pii_chk',
      sql`${t.anonymizedAt} IS NOT NULL OR (${t.email} IS NOT NULL AND ${t.mobileE164} IS NOT NULL)`,
    ),
    index('contacts_list_idx').on(t.ownerId, t.deactivatedAt, t.isFavorite, t.name, t.id),
    index('contacts_name_trgm').using('gin', sql`f_unaccent(lower(${t.name})) gin_trgm_ops`),
    index('contacts_email_trgm').using('gin', sql`(${t.email}::text) gin_trgm_ops`),
    index('contacts_mobile_trgm').using('gin', sql`${t.mobileE164} gin_trgm_ops`),
  ],
);

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
