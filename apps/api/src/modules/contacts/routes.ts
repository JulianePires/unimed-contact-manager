import {
  createContactInputSchema,
  listContactsQuerySchema,
  updateContactInputSchema,
} from '@contatos/contracts';
import type { FastifyPluginCallback, preHandlerAsyncHookHandler } from 'fastify';

import { parseBody, parseQuery } from '@/shared/http/validation';

import { requireUser } from '../auth/hooks';
import type { ContactsRepository } from './repository';
import { anonymizeContact } from './use-cases/anonymize';
import { createContact } from './use-cases/create';
import { deactivateContact } from './use-cases/deactivate';
import { getContact } from './use-cases/get';
import { listContacts } from './use-cases/list';
import { reactivateContact } from './use-cases/reactivate';
import { setFavorite } from './use-cases/set-favorite';
import { updateContact } from './use-cases/update';

export const CONTACTS_PATH = '/api/v1/contacts';

export interface ContactsRoutesOptions {
  contacts: ContactsRepository;
  authenticate: preHandlerAsyncHookHandler;
}

interface ById {
  Params: { id: string };
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

  app.get<ById>('/:id', async (request, reply) => {
    const { contact, etag } = await getContact(
      contacts,
      requireUser(request).id,
      request.params.id,
    );
    return reply.header('etag', etag).send(contact);
  });

  app.patch<ById>('/:id', async (request, reply) => {
    const input = parseBody(updateContactInputSchema, request.body);
    const { contact, etag } = await updateContact(
      contacts,
      requireUser(request).id,
      request.params.id,
      request.headers['if-match'],
      input,
    );
    return reply.header('etag', etag).send(contact);
  });

  app.delete<ById>('/:id', async (request, reply) => {
    await anonymizeContact(contacts, requireUser(request).id, request.params.id);
    return reply.status(204).send();
  });

  app.put<ById>('/:id/favorite', async (request, reply) => {
    await setFavorite(contacts, requireUser(request).id, request.params.id, true);
    return reply.status(204).send();
  });

  app.delete<ById>('/:id/favorite', async (request, reply) => {
    await setFavorite(contacts, requireUser(request).id, request.params.id, false);
    return reply.status(204).send();
  });

  app.post<ById>('/:id/deactivate', async (request, reply) => {
    const { contact, etag } = await deactivateContact(
      contacts,
      requireUser(request).id,
      request.params.id,
    );
    return reply.header('etag', etag).send(contact);
  });

  app.post<ById>('/:id/reactivate', async (request, reply) => {
    const { contact, etag } = await reactivateContact(
      contacts,
      requireUser(request).id,
      request.params.id,
    );
    return reply.header('etag', etag).send(contact);
  });

  done();
};
