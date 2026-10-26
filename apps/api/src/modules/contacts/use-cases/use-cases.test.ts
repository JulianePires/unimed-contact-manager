import { listContactsQuerySchema } from '@contatos/contracts';
import { describe, expect, it } from 'vitest';

import type { Contact as ContactRow } from '@/shared/db/schema';

import type { ContactsRepository } from '../repository';
import { anonymizeContact } from './anonymize';
import { createContact } from './create';
import { deactivateContact } from './deactivate';
import { getContact } from './get';
import { listContacts } from './list';
import { reactivateContact } from './reactivate';
import { setFavorite } from './set-favorite';
import { updateContact } from './update';

const ownerId = '0192f3a1-0000-7000-8000-000000000001';
const id = '0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e';
const now = new Date('2026-10-26T12:00:00.000Z');
const yesterday = new Date('2026-10-25T12:00:00.000Z');

const row = (overrides: Partial<ContactRow> = {}): ContactRow => ({
  id,
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

/** Repositório em memória: por padrão nada existe e nenhuma escrita casa. */
function fakeRepository(overrides: Partial<ContactsRepository> = {}, rows: ContactRow[] = []) {
  const calls: { inserted: unknown[]; updated: unknown[]; findById: string[] } = {
    inserted: [],
    updated: [],
    findById: [],
  };
  const repository: ContactsRepository = {
    insert: (contact) => {
      calls.inserted.push(contact);
      return Promise.resolve({ outcome: 'written', contact: row() });
    },
    update: (...args) => {
      calls.updated.push(args);
      return Promise.resolve({ outcome: 'not-matched' });
    },
    setDeactivated: () => Promise.resolve(undefined),
    setFavorite: () => Promise.resolve(false),
    anonymize: () => Promise.resolve(false),
    findById: (_, contactId) => {
      calls.findById.push(contactId);
      return Promise.resolve(rows.find((candidate) => candidate.id === contactId));
    },
    list: () => Promise.resolve({ contacts: rows, total: 45 }),
    ...overrides,
  };
  return { repository, calls };
}

const input = { name: 'Maria', email: 'maria@exemplo.com', mobile: '+5581999990000', phone: null };

describe('createContact (RF05)', () => {
  it('dado celular livre, então insere os dados normalizados e devolve o recurso com ETag', async () => {
    const { repository, calls } = fakeRepository();

    const result = await createContact(repository, ownerId, input);

    expect(calls.inserted).toEqual([
      {
        ownerId,
        name: 'Maria',
        email: 'maria@exemplo.com',
        mobileE164: input.mobile,
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
    const { repository } = fakeRepository({
      insert: () =>
        Promise.resolve({
          outcome: 'mobile-conflict',
          conflictingContact: { id: 'conflitante', deactivatedAt },
        }),
    });

    await expect(createContact(repository, ownerId, input)).rejects.toMatchObject({
      status: 409,
      code,
      extras: { contactId: 'conflitante' },
    });
  });
});

describe('getContact (RN06)', () => {
  it('dado contato do usuário, então devolve o recurso e o ETag da versão', async () => {
    const { repository } = fakeRepository({}, [row({ version: 4 })]);

    const result = await getContact(repository, ownerId, id);

    expect(result.etag).toBe('"v4"');
    expect(result.contact.id).toBe(id);
  });

  it.each([
    ['inexistente ou de outro usuário', '0192f3a1-7c2e-7b10-9d4e-000000000000'],
    ['malformado', 'nao-e-uuid'],
  ])('dado id %s, então 404', async (_, contactId) => {
    await expect(getContact(fakeRepository().repository, ownerId, contactId)).rejects.toMatchObject(
      { status: 404, code: 'NOT_FOUND' },
    );
  });

  it('dado id malformado, então nem consulta o banco', async () => {
    const { repository, calls } = fakeRepository();

    await expect(getContact(repository, ownerId, "1' OR '1'='1")).rejects.toThrow();
    expect(calls.findById).toEqual([]);
  });
});

describe('listContacts (RF06)', () => {
  it('monta o envelope com os contatos e a paginação', async () => {
    const { repository } = fakeRepository({}, [row()]);
    const query = listContactsQuerySchema.parse({ page: '2', pageSize: '20' });

    const page = await listContacts(repository, ownerId, query);

    expect(page.meta).toEqual({ page: 2, pageSize: 20, total: 45, totalPages: 3 });
    expect(page.data).toEqual([expect.objectContaining({ name: 'Maria', status: 'active' })]);
  });
});

describe('updateContact (RF10, RN07)', () => {
  const changes = { name: 'Maria Souza' };

  it('dado If-Match com a versão atual, então aplica com a versão esperada e devolve o novo ETag', async () => {
    const { repository, calls } = fakeRepository({
      update: (...args) => {
        calls.updated.push(args);
        return Promise.resolve({
          outcome: 'written',
          contact: row({ name: 'Maria Souza', version: 4 }),
        });
      },
    });

    const result = await updateContact(repository, ownerId, id, '"v3"', changes);

    expect(calls.updated).toEqual([
      [
        ownerId,
        id,
        3,
        { name: 'Maria Souza', email: undefined, mobileE164: undefined, phoneE164: undefined },
      ],
    ]);
    expect(result.etag).toBe('"v4"');
    expect(result.contact.name).toBe('Maria Souza');
  });

  it('dado PATCH sem If-Match, então 428 sem tocar no banco', async () => {
    const { repository, calls } = fakeRepository();

    await expect(updateContact(repository, ownerId, id, undefined, changes)).rejects.toMatchObject({
      status: 428,
      code: 'PRECONDITION_REQUIRED',
    });
    expect(calls.updated).toEqual([]);
  });

  it.each([
    ['versão desatualizada', '"v1"'],
    ['If-Match que não é ETag nosso', '*'],
  ])('dado %s, então 412 CONTACT_MODIFIED', async (_, ifMatch) => {
    const { repository } = fakeRepository({}, [row({ version: 2 })]);

    await expect(updateContact(repository, ownerId, id, ifMatch, changes)).rejects.toMatchObject({
      status: 412,
      code: 'CONTACT_MODIFIED',
    });
  });

  it.each([
    ['inexistente, de outro usuário ou eliminado', id],
    ['com id malformado', 'nao-e-uuid'],
  ])('dado contato %s, então 404', async (_, contactId) => {
    await expect(
      updateContact(fakeRepository().repository, ownerId, contactId, '"v1"', changes),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('dado celular de outro contato inativo, então 409 com o id dele', async () => {
    const { repository } = fakeRepository({
      update: () =>
        Promise.resolve({
          outcome: 'mobile-conflict',
          conflictingContact: { id: 'inativo', deactivatedAt: yesterday },
        }),
    });

    await expect(
      updateContact(repository, ownerId, id, '"v1"', { mobile: '+5581988887777' }),
    ).rejects.toMatchObject({
      code: 'MOBILE_BELONGS_TO_INACTIVE_CONTACT',
      extras: { contactId: 'inativo' },
    });
  });
});

describe('inativar e reativar (RF11, RF12, RN08)', () => {
  it('dada a transição, então devolve o contato no novo estado', async () => {
    const { repository } = fakeRepository({
      setDeactivated: () => Promise.resolve(row({ deactivatedAt: yesterday })),
    });

    const result = await deactivateContact(repository, ownerId, id);

    expect(result.contact).toMatchObject({
      status: 'inactive',
      deactivatedAt: yesterday.toISOString(),
    });
    expect(result.etag).toBe('"v1"');
  });

  it('dado contato já inativo, então é idempotente e devolve o estado atual', async () => {
    const { repository } = fakeRepository({}, [row({ deactivatedAt: yesterday })]);

    const result = await deactivateContact(repository, ownerId, id);

    expect(result.contact).toMatchObject({
      status: 'inactive',
      deactivatedAt: yesterday.toISOString(),
    });
  });

  it('dado contato já ativo, então reativar é idempotente', async () => {
    const { repository } = fakeRepository({}, [row()]);

    expect((await reactivateContact(repository, ownerId, id)).contact.status).toBe('active');
  });

  it.each([
    ['inexistente ou eliminado', id],
    ['com id malformado', 'nao-e-uuid'],
  ])('dado contato %s, então 404', async (_, contactId) => {
    await expect(
      reactivateContact(fakeRepository().repository, ownerId, contactId),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('setFavorite (RF13, RN08)', () => {
  it('dado contato do usuário, então grava o favorito', async () => {
    const favorites: boolean[] = [];
    const { repository } = fakeRepository({
      setFavorite: (_, __, value) => {
        favorites.push(value);
        return Promise.resolve(true);
      },
    });

    await setFavorite(repository, ownerId, id, true);
    await setFavorite(repository, ownerId, id, false);

    expect(favorites).toEqual([true, false]);
  });

  it.each([
    ['inexistente ou eliminado', id],
    ['com id malformado', 'nao-e-uuid'],
  ])('dado contato %s, então 404', async (_, contactId) => {
    await expect(
      setFavorite(fakeRepository().repository, ownerId, contactId, true),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('anonymizeContact (RF14, RN09, T-UB06)', () => {
  it('dado contato inativo, então elimina', async () => {
    const { repository } = fakeRepository({ anonymize: () => Promise.resolve(true) });

    await expect(anonymizeContact(repository, ownerId, id)).resolves.toBeUndefined();
  });

  it('dado contato ativo, então 409 CONTACT_MUST_BE_INACTIVE', async () => {
    const { repository } = fakeRepository({}, [row()]);

    await expect(anonymizeContact(repository, ownerId, id)).rejects.toMatchObject({
      status: 409,
      code: 'CONTACT_MUST_BE_INACTIVE',
      extras: { contactId: id },
    });
  });

  it.each([
    ['inexistente ou já eliminado', id],
    ['com id malformado', 'nao-e-uuid'],
  ])('dado contato %s, então 404', async (_, contactId) => {
    await expect(
      anonymizeContact(fakeRepository().repository, ownerId, contactId),
    ).rejects.toMatchObject({ status: 404 });
  });
});
