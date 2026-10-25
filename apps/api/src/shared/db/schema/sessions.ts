import { index, inet, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { bytea, createdAt, timestamptz } from './columns';
import { users } from './users';

export const sessions = pgTable(
  'sessions',
  {
    idHash: bytea('id_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    lastSeenAt: timestamptz('last_seen_at').notNull().defaultNow(),
    expiresAt: timestamptz('expires_at').notNull(),
    userAgent: text('user_agent'),
    ip: inet('ip'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
