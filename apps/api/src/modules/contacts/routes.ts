import {
  contactSchema,
  createContactInputSchema,
  listContactsQuerySchema,
  pageSchema,
  updateContactInputSchema,
} from '@contatos/contracts';
import type { preHandlerAsyncHookHandler } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { noContent, problemResponses } from '@/shared/http/openapi';

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

const tags = ['contacts'];
const byId = z.object({ id: z.string().describe('Id do contato (UUID)') });
const ifMatch = z.object({
  'if-match': z.string().optional().describe('ETag lido no GET, ex.: "v3" (obrigatório)'),
});
const contactPage = pageSchema(contactSchema);

/** Contatos do usuário autenticado (docs/05 §5.4); toda rota exige sessão (RF04). */
export const contactsRoutes: FastifyPluginCallbackZod<ContactsRoutesOptions> = (
  app,
  { contacts, authenticate },
  done,
) => {
  // Antes da validação: sem sessão é 401, qualquer que seja o corpo
  app.addHook('preValidation', authenticate);

  app.get(
    '',
    {
      schema: {
        tags,
        summary: 'Listar contatos com busca, filtros e paginação (RF06–RF08)',
        querystring: listContactsQuerySchema,
        response: { 200: contactPage, ...problemResponses(400, 401) },
      },
    },
    (request) => listContacts(contacts, requireUser(request).id, request.query),
  );

  app.post(
    '',
    {
      schema: {
        tags,
        summary: 'Cadastrar contato (RF05)',
        description:
          'Celular único na agenda, inclusive entre inativos (ADR-001): 409 MOBILE_ALREADY_EXISTS ou MOBILE_BELONGS_TO_INACTIVE_CONTACT, com `contactId`.',
        body: createContactInputSchema,
        response: { 201: contactSchema, ...problemResponses(401, 403, 409, 422) },
      },
    },
    async (request, reply) => {
      const { contact, etag } = await createContact(
        contacts,
        requireUser(request).id,
        request.body,
      );
      return reply
        .status(201)
        .header('location', `${CONTACTS_PATH}/${contact.id}`)
        .header('etag', etag)
        .send(contact);
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        tags,
        summary: 'Consultar contato (RF09); devolve ETag',
        params: byId,
        response: { 200: contactSchema, ...problemResponses(401, 404) },
      },
    },
    async (request, reply) => {
      const { contact, etag } = await getContact(
        contacts,
        requireUser(request).id,
        request.params.id,
      );
      return reply.header('etag', etag).send(contact);
    },
  );

  app.patch(
    '/:id',
    {
      schema: {
        tags,
        summary: 'Editar dados (RF10); exige If-Match',
        description:
          'Sem If-Match → 428; versão desatualizada → 412 CONTACT_MODIFIED (ADR-004). Status e favorito não são aceitos aqui.',
        params: byId,
        headers: ifMatch,
        body: updateContactInputSchema,
        response: { 200: contactSchema, ...problemResponses(401, 403, 404, 409, 412, 422, 428) },
      },
    },
    async (request, reply) => {
      const { contact, etag } = await updateContact(
        contacts,
        requireUser(request).id,
        request.params.id,
        request.headers['if-match'],
        request.body,
      );
      return reply.header('etag', etag).send(contact);
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags,
        summary: 'Eliminar dados pessoais de contato inativo (RF14, LGPD)',
        params: byId,
        response: { 204: noContent, ...problemResponses(401, 403, 404, 409) },
      },
    },
    async (request, reply) => {
      await anonymizeContact(contacts, requireUser(request).id, request.params.id);
      return reply.status(204).send(null);
    },
  );

  app.put(
    '/:id/favorite',
    {
      schema: {
        tags,
        summary: 'Favoritar (RF13, idempotente)',
        params: byId,
        response: { 204: noContent, ...problemResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      await setFavorite(contacts, requireUser(request).id, request.params.id, true);
      return reply.status(204).send(null);
    },
  );

  app.delete(
    '/:id/favorite',
    {
      schema: {
        tags,
        summary: 'Desfavoritar (RF13, idempotente)',
        params: byId,
        response: { 204: noContent, ...problemResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      await setFavorite(contacts, requireUser(request).id, request.params.id, false);
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/:id/deactivate',
    {
      schema: {
        tags,
        summary: 'Inativar (RF11, idempotente)',
        params: byId,
        response: { 200: contactSchema, ...problemResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const { contact, etag } = await deactivateContact(
        contacts,
        requireUser(request).id,
        request.params.id,
      );
      return reply.header('etag', etag).send(contact);
    },
  );

  app.post(
    '/:id/reactivate',
    {
      schema: {
        tags,
        summary: 'Reativar (RF12, idempotente)',
        params: byId,
        response: { 200: contactSchema, ...problemResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      const { contact, etag } = await reactivateContact(
        contacts,
        requireUser(request).id,
        request.params.id,
      );
      return reply.header('etag', etag).send(contact);
    },
  );

  done();
};
