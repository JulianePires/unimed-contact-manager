import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createSessionsRepository } from '@/modules/auth/repositories/sessions';
import { createUsersRepository } from '@/modules/auth/repositories/users';
import { createDatabase, type Database } from '@/shared/db/client';
import { sessions } from '@/shared/db/schema';

import { startMigratedPostgres, truncateAll } from '../helpers/db-container';
import { buildUser, createUser } from '../helpers/factories';

let container: StartedPostgreSqlContainer;
let db: Database;

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
});

describe('repositório de usuários', () => {
  it('dado erro que não é de e-mail duplicado, então propaga o erro', async () => {
    const users = createUsersRepository(db.orm);

    await expect(users.insert(buildUser({ name: 'n'.repeat(121) }))).rejects.toMatchObject({
      cause: { code: '22001' },
    });
  });
});

describe('repositório de sessões', () => {
  it('dado cliente sem user-agent e IP, então grava nulos', async () => {
    const user = await createUser(db.orm);
    const now = new Date('2026-10-26T12:00:00.000Z');

    await createSessionsRepository(db.orm).create({
      userId: user.id,
      now,
      expiresAt: new Date('2026-10-26T14:00:00.000Z'),
      userAgent: undefined,
      ip: undefined,
    });

    expect(
      await db.orm.select({ userAgent: sessions.userAgent, ip: sessions.ip }).from(sessions),
    ).toEqual([{ userAgent: null, ip: null }]);
  });
});
