import { Readable } from 'node:stream';

import fastifyMultipart from '@fastify/multipart';
import { listImportErrorsQuerySchema, listImportsQuerySchema } from '@contatos/contracts';
import type { FastifyPluginAsync, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import { z } from 'zod';

import { AppError } from '@/shared/errors';
import { parseQuery } from '@/shared/http/validation';

import { requireUser } from '../auth/hooks';
import { malformedUpload, missingFile, unsupportedFile } from './domain/errors';
import { IMPORT_TEMPLATE_CSV } from './domain/import';
import type { UploadedFile } from './domain/upload';
import type { ImportsRepository } from './repository';
import { deleteImport } from './use-cases/delete';
import { exportImportErrors } from './use-cases/export-errors';
import { type EnqueueImportDeps, enqueueImport } from './use-cases/enqueue';
import { getImport } from './use-cases/get';
import { listImports } from './use-cases/list';
import { listImportErrors } from './use-cases/list-errors';

export const IMPORTS_PATH = '/api/v1/imports';
const UPLOAD_FIELD = 'file';

export interface ImportsRoutesOptions extends EnqueueImportDeps {
  imports: ImportsRepository;
  maxFileBytes: number;
  authenticate: preHandlerAsyncHookHandler;
}

interface ById {
  Params: { id: string };
}

const uploadQuerySchema = z.object({ force: z.stringbool().default(false) });

const hasHttpStatus = (error: unknown) =>
  error instanceof AppError ||
  (typeof error === 'object' && error !== null && 'statusCode' in error);

/**
 * Lê o arquivo do campo `file`. Acima do limite, o multipart falha com 413 (FILE_TOO_LARGE);
 * corpo truncado ou malformado chega como erro sem status e vira 400, não 500.
 */
async function readUpload(request: FastifyRequest): Promise<UploadedFile> {
  try {
    const part = await request.file();
    if (!part) throw missingFile();
    const content = await part.toBuffer();
    if (part.fieldname !== UPLOAD_FIELD) throw missingFile();
    return { fileName: part.filename, mimeType: part.mimetype, content };
  } catch (error) {
    if (hasHttpStatus(error)) throw error;
    throw malformedUpload();
  }
}

/** Importações do usuário autenticado (docs/05 §5.5); toda rota exige sessão (RF04). */
export const importsRoutes: FastifyPluginAsync<ImportsRoutesOptions> = async (app, options) => {
  const { imports, maxFileBytes, authenticate } = options;
  await app.register(fastifyMultipart, { limits: { fileSize: maxFileBytes, files: 1 } });
  app.addHook('preHandler', authenticate);

  app.post('/', async (request, reply) => {
    const { force } = parseQuery(uploadQuerySchema, request.query);
    if (!request.isMultipart()) throw unsupportedFile();
    const file = await readUpload(request);
    const created = await enqueueImport(options, requireUser(request).id, file, force);
    return reply.status(202).header('location', `${IMPORTS_PATH}/${created.id}`).send(created);
  });

  app.get('/', (request) =>
    listImports(
      imports,
      requireUser(request).id,
      parseQuery(listImportsQuerySchema, request.query),
    ),
  );

  // Antes de /:id: "template.csv" não é um id de importação
  app.get('/template.csv', (_request, reply) =>
    reply
      .type('text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="modelo-importacao-contatos.csv"')
      .send(IMPORT_TEMPLATE_CSV),
  );

  app.get<ById>('/:id', (request) =>
    getImport(imports, requireUser(request).id, request.params.id),
  );

  app.get<ById>('/:id/errors', (request) =>
    listImportErrors(
      imports,
      requireUser(request).id,
      request.params.id,
      parseQuery(listImportErrorsQuerySchema, request.query),
    ),
  );

  app.get<ById>('/:id/errors.csv', async (request, reply) => {
    const { fileName, lines } = await exportImportErrors(
      imports,
      requireUser(request).id,
      request.params.id,
    );
    return reply
      .type('text/csv; charset=utf-8')
      .header('content-disposition', `attachment; filename="${fileName}"`)
      .send(Readable.from(lines));
  });

  app.delete<ById>('/:id', async (request, reply) => {
    await deleteImport(imports, requireUser(request).id, request.params.id);
    return reply.status(204).send();
  });
};
