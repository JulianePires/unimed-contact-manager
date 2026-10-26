import type { FastifyPluginAsync, preHandlerAsyncHookHandler } from 'fastify';

import { importContacts } from '@/modules/contacts';
import type { Orm } from '@/shared/db/client';
import { withTransaction } from '@/shared/db/transaction';
import type { JobHandlers, JobQueue } from '@/shared/queue/job-queue';

import { processImport } from './jobs/process-import';
import { purgeRetention } from './jobs/purge-retention';
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

export interface ImportJobsDeps {
  db: Orm;
  now: () => Date;
  retentionDays: number;
}

/** Handlers dos jobs de importação para o worker (standalone ou embutido na API). */
export function importJobs({ db, now, retentionDays }: ImportJobsDeps): JobHandlers {
  return {
    'process-import': ({ importId }, signal) =>
      processImport({ db, now, importContacts }, importId, signal),
    'purge-retention': () => purgeRetention({ db, now, retentionDays }),
  };
}
