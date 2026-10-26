import {
  type Contact,
  type ContactSort,
  type ContactStatus,
  type CreateContactInput,
  contactSchema,
  type Page,
  pageSchema,
  SEARCH_TERM_MIN_LENGTH,
  type UpdateContactInput,
} from '@contatos/contracts';
import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';
import { z } from 'zod';

import { ApiError, request } from '@/lib/http';

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

export function contactQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['contact', id],
    queryFn: ({ signal }) =>
      request('GET', `${CONTACTS_PATH}/${id}`, { schema: contactSchema, signal }),
  });
}

/** ETag do contato (docs/05 §5.1, ADR-004): derivado da versão lida. */
export function etagOf(contact: Pick<Contact, 'version'>): string {
  return `"v${String(contact.version)}"`;
}

export function createContact(input: CreateContactInput): Promise<Contact> {
  return request('POST', CONTACTS_PATH, { body: input, schema: contactSchema });
}

/** Edição baseada na versão lida: se outra sessão alterou antes, a API responde 412 (RN07). */
export function updateContact(
  contact: Pick<Contact, 'id' | 'version'>,
  input: UpdateContactInput,
): Promise<Contact> {
  return request('PATCH', `${CONTACTS_PATH}/${contact.id}`, {
    body: input,
    headers: { 'If-Match': etagOf(contact) },
    schema: contactSchema,
  });
}

export function deactivateContact(id: string): Promise<Contact> {
  return request('POST', `${CONTACTS_PATH}/${id}/deactivate`, { schema: contactSchema });
}

export function reactivateContact(id: string): Promise<Contact> {
  return request('POST', `${CONTACTS_PATH}/${id}/reactivate`, { schema: contactSchema });
}

/** Eliminação dos dados pessoais (LGPD, ADR-009): só para inativos e irreversível. */
export function anonymizeContact(id: string): Promise<void> {
  return request('DELETE', `${CONTACTS_PATH}/${id}`);
}

const contactIdSchema = z.uuid();

/**
 * Carrega o contato do detalhe e da edição. Inexistente, de outra conta ou eliminado viram a
 * mesma tela "Contato não encontrado", sem revelar qual é o caso (docs/05 §5.2, RN09).
 * `fresh` busca a versão atual, evitando editar sobre um ETag velho do cache.
 */
export async function loadContact(
  queryClient: QueryClient,
  id: string,
  { fresh = false }: { fresh?: boolean } = {},
): Promise<Contact> {
  if (!contactIdSchema.safeParse(id).success) notFound({ throw: true });
  try {
    return await queryClient.query({
      ...contactQueryOptions(id),
      ...(fresh ? { staleTime: 0 } : {}),
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') notFound({ throw: true });
    throw error;
  }
}
