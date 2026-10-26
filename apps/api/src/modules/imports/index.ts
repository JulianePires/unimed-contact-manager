import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from 'fastify';

import type { Orm } from '@/shared/db/client';
import { withTransaction } from '@/shared/db/transaction';
import type { JobQueue } from '@/shared/queue/job-queue';

import { createImportsRepository } from './repository';
import { IMPORTS_PATH, importsRoutes } from './routes';

export interface ImportsModuleDeps {
  db: Orm;
  jobQueue: JobQueue;
  maxFileBytes: number;
  authenticate: preHandlerAsyncHookHandler;
}

/**
 * Módulo de importações: o repositório é montado aqui (ADR-007) e a unidade de trabalho prende
 * repositório e fila à mesma transação (ADR-003).
 */
export function importsModule({ db, jobQueue, maxFileBytes, authenticate }: ImportsModuleDeps) {
  const plugin: FastifyPluginAsync = async (app) => {
    await app.register(importsRoutes, {
      prefix: IMPORTS_PATH,
      imports: createImportsRepository(db),
      inTransaction: (work) =>
        withTransaction(db, (tx) =>
          work({
            imports: createImportsRepository(tx),
            enqueue: (name, payload) => jobQueue.enqueue(tx, name, payload),
          }),
        ),
      maxFileBytes,
      authenticate,
    });
  };
  return plugin;
}
