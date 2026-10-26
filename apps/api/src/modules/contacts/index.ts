import type { CreateContactData } from '@contatos/contracts';
import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from 'fastify';

import type { Executor } from '@/shared/db/transaction';

import { createContactsRepository } from './repository';
import { CONTACTS_PATH, contactsRoutes } from './routes';
import { type ImportedBatch, importContactsBatch } from './use-cases/import-batch';

export type { ImportedBatch } from './use-cases/import-batch';

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

/** Caso de uso público para a importação: grava no executor recebido (a transação do lote). */
export function importContacts(
  executor: Executor,
  ownerId: string,
  batch: readonly CreateContactData[],
): Promise<ImportedBatch> {
  return importContactsBatch(createContactsRepository(executor), ownerId, batch);
}
