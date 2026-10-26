import {
  type Contact,
  contactSchema,
  createContactInputSchema,
  formatPhone,
  listContactsQuerySchema,
  pageMeta,
  pageSchema,
  updateContactInputSchema,
} from '@contatos/contracts';
import { HttpResponse, http } from 'msw';

import { parseBody, problem } from './problem';

const CONTACTS = '/api/v1/contacts';

const NAMES = [
  'Ana Beatriz Lima',
  'André Costa',
  'Bruno Araújo',
  'Camila Rocha',
  'Carlos Eduardo Melo',
  'Daniela Freitas',
  'Eduardo Pires',
  'Fernanda Gomes',
  'Gabriel Nunes',
  'Helena Barros',
  'Igor Teixeira',
  'Joana Dias',
  'João Souza',
  'Júlia Martins',
  'Lucas Ribeiro',
  'Mariana Alves',
  'Marcos Vinícius',
  'Natália Cardoso',
  'Otávio Moreira',
  'Paula Cristina',
  'Rafael Monteiro',
  'Renata Duarte',
  'Sérgio Batista',
  'Tatiane Lopes',
  'Vítor Hugo',
];

/** Agenda simulada: 25 contatos, 1 em cada 4 favorito e 1 em cada 5 inativo. */
function seed(): Contact[] {
  return NAMES.map((name, index) => {
    const mobile = `+558199990${String(index).padStart(4, '0')}`;
    const createdAt = new Date(Date.UTC(2026, 9, 1 + index, 12)).toISOString();
    const inactive = index % 5 === 4;
    return contactSchema.parse({
      id: `0192f3a1-0000-7000-8000-${String(index + 100).padStart(12, '0')}`,
      name,
      email: `${slug(name)}@empresa.com`,
      mobile,
      mobileFormatted: formatPhone(mobile),
      phone: null,
      phoneFormatted: null,
      isFavorite: index % 4 === 0,
      status: inactive ? 'inactive' : 'active',
      deactivatedAt: inactive ? createdAt : null,
      version: 1,
      createdAt,
      updatedAt: createdAt,
    });
  });
}

let contacts = seed();

/** Volta ao estado inicial entre testes (setup.ts). */
export function resetContacts(): void {
  contacts = seed();
}

/** Substitui a agenda simulada (ex.: `[]` para a agenda vazia). */
export function setContacts(next: Contact[]): void {
  contacts = next;
}

/** Simula uma edição feita em outra sessão: nova versão no "servidor" (ADR-004). */
export function editElsewhere(name: string, changes: Partial<Contact>): Contact {
  const current = findContact(name);
  const edited = { ...current, ...changes, version: current.version + 1 };
  contacts = contacts.map((contact) => (contact.id === current.id ? edited : contact));
  return edited;
}

export function findContact(name: string): Contact {
  const contact = contacts.find((item) => item.name === name);
  if (!contact) throw new Error(`Contato de teste inexistente: ${name}`);
  return contact;
}

function slug(value: string): string {
  return normalize(value).replace(/[^a-z]+/g, '.');
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/** Mesma intenção de busca da API (ADR-005): dígitos → celular; com `@` → e-mail; senão nome/e-mail. */
function matches(contact: Contact, q: string): boolean {
  const digits = q.replace(/\D/g, '');
  if (digits.length > 0 && digits.length === q.replace(/[\s().+-]/g, '').length) {
    return contact.mobile.includes(digits);
  }
  const term = normalize(q);
  if (q.includes('@')) return contact.email.includes(term);
  return normalize(contact.name).includes(term) || contact.email.includes(term);
}

const COMPARE = {
  name: (a: Contact, b: Contact) => a.name.localeCompare(b.name, 'pt-BR'),
  createdAt: (a: Contact, b: Contact) => a.createdAt.localeCompare(b.createdAt),
};

export const contactHandlers = [
  http.get(CONTACTS, ({ request }) => {
    const query = listContactsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const [field, descending] = query.sort.startsWith('-')
      ? [query.sort.slice(1) as 'name' | 'createdAt', true]
      : [query.sort as 'name' | 'createdAt', false];
    const filtered = contacts
      .filter((contact) => query.status === 'all' || contact.status === query.status)
      .filter((contact) => query.favorite === undefined || contact.isFavorite === query.favorite)
      .filter((contact) => query.q === undefined || matches(contact, query.q))
      .toSorted((a, b) => (descending ? -1 : 1) * COMPARE[field](a, b));
    const start = (query.page - 1) * query.pageSize;

    return HttpResponse.json(
      pageSchema(contactSchema).parse({
        data: filtered.slice(start, start + query.pageSize),
        meta: pageMeta(query, filtered.length),
      }),
    );
  }),

  http.put(`${CONTACTS}/:id/favorite`, ({ params }) => setFavorite(String(params['id']), true)),
  http.delete(`${CONTACTS}/:id/favorite`, ({ params }) => setFavorite(String(params['id']), false)),

  http.get(`${CONTACTS}/:id`, ({ params }) => {
    const contact = byId(params['id']);
    return contact ? withEtag(contact) : notFound();
  }),

  http.post(CONTACTS, async ({ request }) => {
    const body = await parseBody(request, createContactInputSchema);
    if (!body.ok) return body.response;
    const conflict = mobileConflict(body.data.mobile);
    if (conflict) return conflict;
    const now = new Date().toISOString();
    const contact = contactSchema.parse({
      id: crypto.randomUUID(),
      ...body.data,
      mobileFormatted: formatPhone(body.data.mobile),
      phoneFormatted: body.data.phone ? formatPhone(body.data.phone) : null,
      isFavorite: false,
      status: 'active',
      deactivatedAt: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    contacts = [...contacts, contact];
    return withEtag(contact, 201);
  }),

  http.patch(`${CONTACTS}/:id`, async ({ params, request }) => {
    const current = byId(params['id']);
    if (!current) return notFound();
    const ifMatch = request.headers.get('if-match');
    if (!ifMatch) return problem('PRECONDITION_REQUIRED', 'Informe a versão do contato');
    if (ifMatch !== etag(current)) {
      return problem('CONTACT_MODIFIED', 'O contato foi alterado em outra sessão');
    }
    const body = await parseBody(request, updateContactInputSchema);
    if (!body.ok) return body.response;
    const conflict = body.data.mobile ? mobileConflict(body.data.mobile, current.id) : undefined;
    if (conflict) return conflict;
    const { phone, ...changes } = body.data;
    const updated = contactSchema.parse({
      ...current,
      ...Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)),
      ...(phone === undefined ? {} : { phone, phoneFormatted: phone ? formatPhone(phone) : null }),
      ...(changes.mobile ? { mobileFormatted: formatPhone(changes.mobile) } : {}),
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    });
    contacts = contacts.map((contact) => (contact.id === current.id ? updated : contact));
    return withEtag(updated);
  }),

  http.post(`${CONTACTS}/:id/deactivate`, ({ params }) => setStatus(params['id'], 'inactive')),
  http.post(`${CONTACTS}/:id/reactivate`, ({ params }) => setStatus(params['id'], 'active')),

  http.delete(`${CONTACTS}/:id`, ({ params }) => {
    const contact = byId(params['id']);
    if (!contact) return notFound();
    if (contact.status === 'active') {
      return problem('CONTACT_MUST_BE_INACTIVE', 'Inative o contato antes de eliminar os dados');
    }
    contacts = contacts.filter((item) => item.id !== contact.id);
    return new HttpResponse(null, { status: 204 });
  }),
];

function byId(id: unknown): Contact | undefined {
  return contacts.find((contact) => contact.id === id);
}

function etag(contact: Contact): string {
  return `"v${String(contact.version)}"`;
}

function withEtag(contact: Contact, status = 200) {
  return HttpResponse.json(contact, { status, headers: { etag: etag(contact) } });
}

/** Mesma resposta para inexistente, de outra conta ou eliminado (docs/05 §5.2). */
function notFound() {
  return problem('NOT_FOUND', 'Contato não encontrado');
}

/** Unicidade do celular na agenda, inclusive entre inativos (ADR-001). */
function mobileConflict(mobile: string, exceptId?: string) {
  const owner = contacts.find((contact) => contact.mobile === mobile && contact.id !== exceptId);
  if (!owner) return undefined;
  return owner.status === 'active'
    ? problem('MOBILE_ALREADY_EXISTS', 'Celular já cadastrado', { contactId: owner.id })
    : problem('MOBILE_BELONGS_TO_INACTIVE_CONTACT', 'Celular de contato inativo', {
        contactId: owner.id,
      });
}

function setStatus(id: unknown, status: Contact['status']) {
  const current = byId(id);
  if (!current) return notFound();
  const updated: Contact = {
    ...current,
    status,
    deactivatedAt:
      status === 'inactive' ? (current.deactivatedAt ?? new Date().toISOString()) : null,
    version: current.version + 1,
  };
  contacts = contacts.map((contact) => (contact.id === current.id ? updated : contact));
  return HttpResponse.json(updated);
}

function setFavorite(id: string, isFavorite: boolean) {
  contacts = contacts.map((contact) => (contact.id === id ? { ...contact, isFavorite } : contact));
  return new HttpResponse(null, { status: 204 });
}
