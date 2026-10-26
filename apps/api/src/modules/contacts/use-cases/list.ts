import { type Contact, type ListContactsQuery, type Page, pageMeta } from '@contatos/contracts';

import { toContact } from '../domain/contact';
import type { ContactsRepository } from '../repository';

/** Listagem paginada com busca, filtros e ordenação estável (RF06–RF08). */
export async function listContacts(
  contacts: ContactsRepository,
  ownerId: string,
  query: ListContactsQuery,
): Promise<Page<Contact>> {
  const { contacts: records, total } = await contacts.list(ownerId, query);
  return { data: records.map(toContact), meta: pageMeta(query, total) };
}
