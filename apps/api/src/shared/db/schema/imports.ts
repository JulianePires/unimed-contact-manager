import type { FieldError } from '@contatos/contracts';
import {
  bigint,
  char,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { bytea, createdAt, timestamptz } from './columns';
import { users } from './users';

const counter = (name: string) => integer(name).notNull().default(0);

export const imports = pgTable(
  'imports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSha256: char('file_sha256', { length: 64 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('PENDING'),
    totalRows: counter('total_rows'),
    processedRows: counter('processed_rows'),
    createdCount: counter('created_count'),
    skippedCount: counter('skipped_count'),
    failedCount: counter('failed_count'),
    failureReason: text('failure_reason'),
    createdAt: createdAt(),
    startedAt: timestamptz('started_at'),
    finishedAt: timestamptz('finished_at'),
  },
  (t) => [index('imports_owner_hash_idx').on(t.ownerId, t.fileSha256)],
);

export const importFiles = pgTable('import_files', {
  importId: uuid('import_id')
    .primaryKey()
    .references(() => imports.id, { onDelete: 'cascade' }),
  content: bytea('content').notNull(),
});

export const importErrors = pgTable(
  'import_errors',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    importId: uuid('import_id')
      .notNull()
      .references(() => imports.id, { onDelete: 'cascade' }),
    lineNumber: integer('line_number').notNull(),
    raw: jsonb('raw').$type<Record<string, string>>(),
    errors: jsonb('errors').$type<FieldError[]>().notNull(),
  },
  (t) => [index('import_errors_import_line_idx').on(t.importId, t.lineNumber)],
);

export type Import = typeof imports.$inferSelect;
export type NewImport = typeof imports.$inferInsert;
export type ImportError = typeof importErrors.$inferSelect;
export type NewImportError = typeof importErrors.$inferInsert;
