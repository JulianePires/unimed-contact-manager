import { createContactInputSchema, listContactsQuerySchema } from '@contatos/contracts';
import type { FastifyPluginCallback, preHandlerAsyncHookHandler } from 'fastify';

import { parseBody, parseQuery } from '@/shared/http/validation';

import { requireUser } from '../auth/hooks';
import type { ContactsRepository } from './repository';
import { createContact } from './use-cases/create';
import { getContact } from './use-cases/get';
import { listContacts } from './use-cases/list';

export const CONTACTS_PATH = '/api/v1/contacts';

export interface ContactsRoutesOptions {
  contacts: ContactsRepository;
  authenticate: preHandlerAsyncHookHandler;
}

/** Contatos do usuário autenticado (docs/05 §5.4); toda rota exige sessão (RF04). */
export const contactsRoutes: FastifyPluginCallback<ContactsRoutesOptions> = (
  app,
  { contacts, authenticate },
  done,
) => {
  app.addHook('preHandler', authenticate);

  app.get('/', (request) =>
    listContacts(
      contacts,
      requireUser(request).id,
      parseQuery(listContactsQuerySchema, request.query),
    ),
  );

  app.post('/', async (request, reply) => {
    const input = parseBody(createContactInputSchema, request.body);
    const { contact, etag } = await createContact(contacts, requireUser(request).id, input);
    return reply
      .status(201)
      .header('location', `${CONTACTS_PATH}/${contact.id}`)
      .header('etag', etag)
      .send(contact);
  });

  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { contact, etag } = await getContact(
      contacts,
      requireUser(request).id,
      request.params.id,
    );
    return reply.header('etag', etag).send(contact);
  });

  done();
};
