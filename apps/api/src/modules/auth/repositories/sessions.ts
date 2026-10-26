import { createHash, randomBytes } from 'node:crypto';

import { and, eq, gt, lt } from 'drizzle-orm';

import { sessions, type User, users } from '@/shared/db/schema';
import type { Executor } from '@/shared/db/transaction';

const TOKEN_BYTES = 32;

/** Só o hash vai para o banco: um vazamento da tabela não entrega sessões válidas (ADR-006). */
export function hashSessionToken(token: string): Buffer {
  return createHash('sha256').update(token).digest();
}

export interface NewSessionData {
  userId: string;
  now: Date;
  expiresAt: Date;
  userAgent: string | undefined;
  ip: string | undefined;
}

export interface ActiveSession {
  idHash: Buffer;
  createdAt: Date;
  lastSeenAt: Date;
  user: Pick<User, 'id' | 'name' | 'email'>;
}

export function createSessionsRepository(db: Executor) {
  return {
    /** Gera o identificador (32 bytes aleatórios) e devolve o valor em claro só para o cookie. */
    async create({ userId, now, expiresAt, userAgent, ip }: NewSessionData): Promise<string> {
      const token = randomBytes(TOKEN_BYTES).toString('base64url');
      await db.insert(sessions).values({
        idHash: hashSessionToken(token),
        userId,
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
        userAgent: userAgent ?? null,
        ip: ip ?? null,
      });
      return token;
    },

    async findActive(token: string, now: Date): Promise<ActiveSession | undefined> {
      const [row] = await db
        .select({
          idHash: sessions.idHash,
          createdAt: sessions.createdAt,
          lastSeenAt: sessions.lastSeenAt,
          user: { id: users.id, name: users.name, email: users.email },
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(and(eq(sessions.idHash, hashSessionToken(token)), gt(sessions.expiresAt, now)));
      return row;
    },

    /** Renova a atividade; a condição em `last_seen_at` evita escritas concorrentes repetidas. */
    async touch(idHash: Buffer, { now, expiresAt, touchedBefore }: TouchData): Promise<void> {
      await db
        .update(sessions)
        .set({ lastSeenAt: now, expiresAt })
        .where(and(eq(sessions.idHash, idHash), lt(sessions.lastSeenAt, touchedBefore)));
    },

    async delete(token: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.idHash, hashSessionToken(token)));
    },

    async deleteAllOfUser(userId: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.userId, userId));
    },
  };
}

interface TouchData {
  now: Date;
  expiresAt: Date;
  touchedBefore: Date;
}

export type SessionsRepository = ReturnType<typeof createSessionsRepository>;
