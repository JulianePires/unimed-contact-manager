import { describe, expect, it } from 'vitest';

import type { User } from '@/shared/db/schema';

import { hashPassword } from '../password-hasher';
import type { NewSessionData, SessionsRepository } from '../repositories/sessions';
import type { UsersRepository } from '../repositories/users';
import { login } from './login';
import { logout } from './logout';
import { logoutAll } from './logout-all';
import { me } from './me';
import { register } from './register';

const now = new Date('2026-10-26T12:00:00.000Z');
const policy = { idleMinutes: 120, maxDays: 7 };
const client = { userAgent: 'vitest', ip: '127.0.0.1' };

function fakeUsers(existing: User[] = []): UsersRepository {
  const rows = [...existing];
  return {
    insert: (user) => {
      if (rows.some((row) => row.email.toLowerCase() === user.email.toLowerCase())) {
        return Promise.resolve(null);
      }
      const created: User = {
        ...user,
        id: user.id ?? `user-${rows.length + 1}`,
        createdAt: user.createdAt ?? now,
      };
      rows.push(created);
      return Promise.resolve(created);
    },
    findByEmail: (email) => Promise.resolve(rows.find((row) => row.email === email)),
  };
}

function fakeSessions() {
  const created: NewSessionData[] = [];
  const deleted: string[] = [];
  const deletedUsers: string[] = [];
  const repository: SessionsRepository = {
    create: (data) => {
      created.push(data);
      return Promise.resolve(`token-${created.length}`);
    },
    findActive: () => Promise.resolve(undefined),
    touch: () => Promise.resolve(),
    delete: (token) => {
      deleted.push(token);
      return Promise.resolve();
    },
    deleteAllOfUser: (userId) => {
      deletedUsers.push(userId);
      return Promise.resolve();
    },
  };
  return { repository, created, deleted, deletedUsers };
}

const input = { name: 'Maria', email: 'maria@exemplo.com', password: 'senha-forte-123' };

describe('register (UC01)', () => {
  it('dado e-mail novo, então grava o hash argon2id e abre sessão com expiração por inatividade', async () => {
    const users = fakeUsers();
    const sessions = fakeSessions();

    const result = await register(
      { users, sessions: sessions.repository, policy, now: () => now },
      input,
      client,
    );

    expect(result).toEqual({
      user: { id: 'user-1', name: 'Maria', email: 'maria@exemplo.com' },
      sessionToken: 'token-1',
    });
    const stored = await users.findByEmail(input.email);
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored?.passwordHash).not.toContain(input.password);
    expect(sessions.created).toEqual([
      {
        userId: 'user-1',
        now,
        expiresAt: new Date('2026-10-26T14:00:00.000Z'),
        ...client,
      },
    ]);
  });

  it('dado e-mail já cadastrado, então falha com 409 genérico e não abre sessão', async () => {
    const sessions = fakeSessions();
    const deps = { users: fakeUsers(), sessions: sessions.repository, policy, now: () => now };
    await register(deps, input, client);

    const duplicate = register(deps, { ...input, email: 'MARIA@exemplo.com' }, client);

    await expect(duplicate).rejects.toMatchObject({ status: 409, code: 'REGISTRATION_FAILED' });
    expect(sessions.created).toHaveLength(1);
  });
});

describe('login (UC02)', () => {
  async function depsWithUser() {
    const user: User = {
      id: 'user-1',
      name: 'Maria',
      email: input.email,
      passwordHash: await hashPassword(input.password),
      createdAt: now,
    };
    const sessions = fakeSessions();
    return {
      sessions,
      deps: { users: fakeUsers([user]), sessions: sessions.repository, policy, now: () => now },
    };
  }

  it('dado credenciais válidas, então abre uma sessão nova a cada login', async () => {
    const { deps, sessions } = await depsWithUser();

    const first = await login(deps, input, client);
    const second = await login(deps, input, client);

    expect(first.user).toEqual({ id: 'user-1', name: 'Maria', email: input.email });
    expect(first.sessionToken).not.toBe(second.sessionToken);
    expect(sessions.created).toHaveLength(2);
  });

  it.each([
    ['senha errada', { email: input.email, password: 'senha-errada-123' }],
    ['e-mail inexistente', { email: 'ninguem@exemplo.com', password: input.password }],
  ])('dado %s, então falha com 401 genérico e não abre sessão', async (_, credentials) => {
    const { deps, sessions } = await depsWithUser();

    await expect(login(deps, credentials, client)).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      title: 'E-mail ou senha inválidos',
    });
    expect(sessions.created).toHaveLength(0);
  });
});

describe('logout, logout-all e me (UC03)', () => {
  it('logout remove a sessão do token informado', async () => {
    const sessions = fakeSessions();

    await logout(sessions.repository, 'token-1');

    expect(sessions.deleted).toEqual(['token-1']);
  });

  it('logout-all remove todas as sessões do usuário', async () => {
    const sessions = fakeSessions();

    await logoutAll(sessions.repository, 'user-1');

    expect(sessions.deletedUsers).toEqual(['user-1']);
  });

  it('me expõe só id, nome e e-mail', () => {
    const user = { id: 'user-1', name: 'Maria', email: input.email, passwordHash: 'x' };

    expect(me(user)).toEqual({ id: 'user-1', name: 'Maria', email: input.email });
  });
});
