import { listContactsQuerySchema } from '@contatos/contracts';
import { describe, expect, it } from 'vitest';

import type { Contact as ContactRow } from '@/shared/db/schema';

import type { ContactsRepository, InsertContactResult } from '../repository';
import { createContact } from './create';
import { getContact } from './get';
import { listContacts } from './list';

const ownerId = '0192f3a1-0000-7000-8000-000000000001';
const now = new Date('2026-10-26T12:00:00.000Z');

const row = (overrides: Partial<ContactRow> = {}): ContactRow => ({
  id: '0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e',
  ownerId,
  name: 'Maria',
  email: 'maria@exemplo.com',
  mobileE164: '+5581999990000',
  phoneE164: null,
  isFavorite: false,
  deactivatedAt: null,
  anonymizedAt: null,
  version: 1,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

function fakeRepository(insertResult: InsertContactResult, rows: ContactRow[] = []) {
  const calls: { inserted: unknown[]; findById: string[] } = { inserted: [], findById: [] };
  const repository: ContactsRepository = {
    insert: (contact) => {
      calls.inserted.push(contact);
      return Promise.resolve(insertResult);
    },
    findById: (_, id) => {
      calls.findById.push(id);
      return Promise.resolve(rows.find((candidate) => candidate.id === id));
    },
    list: () => Promise.resolve({ contacts: rows, total: 45 }),
  };
  return { repository, calls };
}

const input = { name: 'Maria', email: 'maria@exemplo.com', mobile: '+5581999990000', phone: null };

describe('createContact (RF05)', () => {
  it('dado celular livre, então insere os dados normalizados e devolve o recurso com ETag', async () => {
    const { repository, calls } = fakeRepository({ ok: true, contact: row() });

    const result = await createContact(repository, ownerId, input);

    expect(calls.inserted).toEqual([
      {
        ownerId,
        name: 'Maria',
        email: 'maria@exemplo.com',
        mobileE164: '+5581999990000',
        phoneE164: null,
      },
    ]);
    expect(result.etag).toBe('"v1"');
    expect(result.contact).toMatchObject({ mobile: '+5581999990000', status: 'active' });
  });

  it.each([
    [null, 'MOBILE_ALREADY_EXISTS'],
    [now, 'MOBILE_BELONGS_TO_INACTIVE_CONTACT'],
  ])('dado conflito com contato (deactivatedAt=%s), então 409 %s', async (deactivatedAt, code) => {
    const conflictingContact = { id: 'conflitante', deactivatedAt };
    const { repository } = fakeRepository({ ok: false, conflictingContact });

    await expect(createContact(repository, ownerId, input)).rejects.toMatchObject({
      status: 409,
      code,
      extras: { contactId: 'conflitante' },
    });
  });
});

describe('getContact (RN06)', () => {
  it('dado contato do usuário, então devolve o recurso e o ETag da versão', async () => {
    const { repository } = fakeRepository({ ok: true, contact: row() }, [row({ version: 4 })]);

    const result = await getContact(repository, ownerId, row().id);

    expect(result.etag).toBe('"v4"');
    expect(result.contact.id).toBe(row().id);
  });

  it.each([
    ['inexistente ou de outro usuário', '0192f3a1-7c2e-7b10-9d4e-000000000000'],
    ['malformado', 'nao-e-uuid'],
  ])('dado id %s, então 404', async (_, id) => {
    const { repository } = fakeRepository({ ok: true, contact: row() });

    await expect(getContact(repository, ownerId, id)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('dado id malformado, então nem consulta o banco', async () => {
    const { repository, calls } = fakeRepository({ ok: true, contact: row() });

    await expect(getContact(repository, ownerId, "1' OR '1'='1")).rejects.toThrow();
    expect(calls.findById).toEqual([]);
  });
});

describe('listContacts (RF06)', () => {
  it('monta o envelope com os contatos e a paginação', async () => {
    const { repository } = fakeRepository({ ok: true, contact: row() }, [row()]);
    const query = listContactsQuerySchema.parse({ page: '2', pageSize: '20' });

    const page = await listContacts(repository, ownerId, query);

    expect(page.meta).toEqual({ page: 2, pageSize: 20, total: 45, totalPages: 3 });
    expect(page.data).toEqual([expect.objectContaining({ name: 'Maria', status: 'active' })]);
  });
});
