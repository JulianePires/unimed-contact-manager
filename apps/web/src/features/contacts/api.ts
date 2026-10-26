import {
  type Contact,
  type ContactSort,
  type ContactStatus,
  contactSchema,
  type Page,
  pageSchema,
  SEARCH_TERM_MIN_LENGTH,
} from '@contatos/contracts';
import { type QueryClient, queryOptions } from '@tanstack/react-query';

import { request } from '@/lib/http';

const CONTACTS_PATH = '/api/v1/contacts';
const contactPageSchema = pageSchema(contactSchema);

export type StatusFilter = ContactStatus | 'all';

/** Filtros da lista que ficam na URL (docs/06 §6.1). */
export interface ContactsFilters {
  page: number;
  pageSize: number;
  status: StatusFilter;
  favorite?: boolean | undefined;
  sort: ContactSort;
}

/** Consulta completa: filtros da URL + termo de busca, que só existe em memória (RN16). */
export interface ContactsQuery extends ContactsFilters {
  q?: string | undefined;
}

/** Termo efetivo: aparado e só a partir de 2 caracteres (ADR-005); abaixo disso, sem busca. */
export function searchTerm(raw: string): string | undefined {
  const term = raw.trim();
  return term.length >= SEARCH_TERM_MIN_LENGTH ? term : undefined;
}

export function contactsQueryOptions(query: ContactsQuery) {
  return queryOptions({
    queryKey: ['contacts', query],
    queryFn: ({ signal }) =>
      request('GET', `${CONTACTS_PATH}?${toSearchParams(query)}`, {
        schema: contactPageSchema,
        signal,
      }),
  });
}

function toSearchParams({ page, pageSize, status, favorite, sort, q }: ContactsQuery): string {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    status,
    sort,
  });
  if (favorite !== undefined) params.set('favorite', String(favorite));
  if (q) params.set('q', q);
  return params.toString();
}

export function setFavorite(id: string, favorite: boolean): Promise<void> {
  return request(favorite ? 'PUT' : 'DELETE', `${CONTACTS_PATH}/${id}/favorite`);
}

/** Aplica o favorito às listas em cache antes da nova consulta, evitando o "pisca" do botão. */
export function setFavoriteInCache(queryClient: QueryClient, id: string, isFavorite: boolean) {
  queryClient.setQueriesData<Page<Contact>>({ queryKey: ['contacts'] }, (page) =>
    page
      ? {
          ...page,
          data: page.data.map((contact) =>
            contact.id === id ? { ...contact, isFavorite } : contact,
          ),
        }
      : page,
  );
}
