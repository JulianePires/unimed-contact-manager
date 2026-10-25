import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type Database } from '@/shared/db/client';
import { contacts, type User } from '@/shared/db/schema';
import { withTransaction } from '@/shared/db/transaction';

import { startMigratedPostgres, truncateAll } from '../helpers/db-container';
import { buildContact, createUser } from '../helpers/factories';

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

const countContacts = async () => (await db.orm.select().from(contacts)).length;

describe('withTransaction', () => {
  it('dado um trabalho concluído, então confirma as escritas e devolve o resultado', async () => {
    const result = await withTransaction(db.orm, async (tx) => {
      await tx.insert(contacts).values(buildContact(owner.id));
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(await countContacts()).toBe(1);
  });

  it('dado um erro no trabalho, então desfaz as escritas e propaga o erro', async () => {
    const failing = withTransaction(db.orm, async (tx) => {
      await tx.insert(contacts).values(buildContact(owner.id));
      throw new Error('falha no meio');
    });

    await expect(failing).rejects.toThrow('falha no meio');
    expect(await countContacts()).toBe(0);
  });

  it('dado um erro numa transação aninhada, então desfaz só o savepoint', async () => {
    await withTransaction(db.orm, async (tx) => {
      await tx.insert(contacts).values(buildContact(owner.id));
      const nested = withTransaction(tx, async (inner) => {
        await inner.insert(contacts).values(buildContact(owner.id));
        throw new Error('falha aninhada');
      });
      await expect(nested).rejects.toThrow('falha aninhada');
    });

    expect(await countContacts()).toBe(1);
  });
});
