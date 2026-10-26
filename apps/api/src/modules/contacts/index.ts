import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from 'fastify';

import type { Executor } from '@/shared/db/transaction';

import { createContactsRepository } from './repository';
import { CONTACTS_PATH, contactsRoutes } from './routes';

/** Módulo de contatos: o repositório é montado aqui e não sai do módulo (ADR-007). */
export function contactsModule(db: Executor, authenticate: preHandlerAsyncHookHandler) {
  const plugin: FastifyPluginAsync = async (app) => {
    await app.register(contactsRoutes, {
      prefix: CONTACTS_PATH,
      contacts: createContactsRepository(db),
      authenticate,
    });
  };
  return plugin;
}
