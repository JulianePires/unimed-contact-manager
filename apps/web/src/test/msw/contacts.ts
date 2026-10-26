import {
  type Contact,
  contactSchema,
  formatPhone,
  listContactsQuerySchema,
  pageMeta,
  pageSchema,
} from '@contatos/contracts';
import { HttpResponse, http } from 'msw';

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
];

function setFavorite(id: string, isFavorite: boolean) {
  contacts = contacts.map((contact) => (contact.id === id ? { ...contact, isFavorite } : contact));
  return new HttpResponse(null, { status: 204 });
}
