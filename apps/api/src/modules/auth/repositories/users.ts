import { eq } from 'drizzle-orm';

import { isUniqueViolation } from '@/shared/db/errors';
import { single } from '@/shared/db/rows';
import { type NewUser, type User, users } from '@/shared/db/schema';
import type { Executor } from '@/shared/db/transaction';

export function createUsersRepository(db: Executor) {
  return {
    /** Devolve `null` se o e-mail já existe (users_email_uq), sem consulta prévia. */
    async insert(user: NewUser): Promise<User | null> {
      try {
        return single(await db.insert(users).values(user).returning());
      } catch (error) {
        if (isUniqueViolation(error, 'users_email_uq')) return null;
        throw error;
      }
    },

    async findByEmail(email: string): Promise<User | undefined> {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    },
  };
}

export type UsersRepository = ReturnType<typeof createUsersRepository>;
