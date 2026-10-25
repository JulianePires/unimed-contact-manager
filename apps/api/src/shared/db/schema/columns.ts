import { customType, timestamp } from 'drizzle-orm/pg-core';

export const citext = customType<{ data: string }>({ dataType: () => 'citext' });

export const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const createdAt = () => timestamptz('created_at').notNull().defaultNow();
