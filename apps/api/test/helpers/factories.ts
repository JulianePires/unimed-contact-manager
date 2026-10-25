import type { Orm } from '@/shared/db/client';
import {
  type Contact,
  contacts,
  type Import,
  imports,
  type NewContact,
  type NewImport,
  type NewUser,
  type User,
  users,
} from '@/shared/db/schema';

let sequence = 0;
const next = () => ++sequence;

export function buildUser(overrides: Partial<NewUser> = {}): NewUser {
  const n = next();
  return {
    email: `usuario${n}@exemplo.com`,
    passwordHash: 'hash-de-teste',
    name: `Usuário ${n}`,
    ...overrides,
  };
}

export function buildContact(ownerId: string, overrides: Partial<NewContact> = {}): NewContact {
  const n = next();
  return {
    ownerId,
    name: `Contato ${n}`,
    email: `contato${n}@exemplo.com`,
    mobileE164: `+55819${String(n).padStart(8, '0')}`,
    ...overrides,
  };
}

export function buildImport(ownerId: string, overrides: Partial<NewImport> = {}): NewImport {
  const n = next();
  return {
    ownerId,
    fileName: `contatos-${n}.csv`,
    fileSha256: n.toString(16).padStart(64, '0'),
    ...overrides,
  };
}

async function insertOne<T>(rows: Promise<T[]>): Promise<T> {
  const [row] = await rows;
  if (row === undefined) throw new Error('Inserção não retornou linha');
  return row;
}

export function createUser(orm: Orm, overrides?: Partial<NewUser>): Promise<User> {
  return insertOne(orm.insert(users).values(buildUser(overrides)).returning());
}

export function createContact(
  orm: Orm,
  ownerId: string,
  overrides?: Partial<NewContact>,
): Promise<Contact> {
  return insertOne(orm.insert(contacts).values(buildContact(ownerId, overrides)).returning());
}

export function createImport(
  orm: Orm,
  ownerId: string,
  overrides?: Partial<NewImport>,
): Promise<Import> {
  return insertOne(orm.insert(imports).values(buildImport(ownerId, overrides)).returning());
}
