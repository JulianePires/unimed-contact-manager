import { Readable } from 'node:stream';

import fastifyMultipart from '@fastify/multipart';
import {
  importErrorSchema,
  importSchema,
  listImportErrorsQuerySchema,
  listImportsQuerySchema,
  pageSchema,
} from '@contatos/contracts';
import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { AppError } from '@/shared/errors';
import { type MultipartDocs, noContent, problemResponses } from '@/shared/http/openapi';

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

const tags = ['imports'];
const byId = z.object({ id: z.string().describe('Id da importação (UUID)') });
const uploadQuerySchema = z.object({
  force: z.stringbool().default(false).describe('true reprocessa um arquivo já importado (RN13)'),
});
const csvResponse = (description: string) => z.unknown().describe(description);
const uploadDocs: MultipartDocs = {
  multipartFile: { field: UPLOAD_FIELD, description: 'Arquivo CSV (até IMPORT_MAX_BYTES)' },
};

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
export const importsRoutes: FastifyPluginAsyncZod<ImportsRoutesOptions> = async (app, options) => {
  const { imports, maxFileBytes, authenticate } = options;
  await app.register(fastifyMultipart, { limits: { fileSize: maxFileBytes, files: 1 } });
  // Antes da validação: sem sessão é 401, qualquer que seja a query
  app.addHook('preValidation', authenticate);

  app.post(
    '',
    {
      config: uploadDocs,
      schema: {
        tags,
        summary: 'Enviar CSV para importação (RF15, RN13)',
        description:
          'multipart/form-data com o campo `file`. Mesmo conteúdo já importado sem force → 409 IMPORT_ALREADY_EXISTS com importId e importedAt.',
        querystring: uploadQuerySchema,
        response: { 202: importSchema, ...problemResponses(400, 401, 403, 409, 413, 415, 422) },
      },
    },
    async (request, reply) => {
      if (!request.isMultipart()) throw unsupportedFile();
      const file = await readUpload(request);
      const created = await enqueueImport(
        options,
        requireUser(request).id,
        file,
        request.query.force,
      );
      return reply.status(202).header('location', `${IMPORTS_PATH}/${created.id}`).send(created);
    },
  );

  app.get(
    '',
    {
      schema: {
        tags,
        summary: 'Histórico de importações, mais recentes primeiro (RF21)',
        querystring: listImportsQuerySchema,
        response: { 200: pageSchema(importSchema), ...problemResponses(400, 401) },
      },
    },
    (request) => listImports(imports, requireUser(request).id, request.query),
  );

  // Antes de /:id: "template.csv" não é um id de importação
  app.get(
    '/template.csv',
    {
      schema: {
        tags,
        summary: 'Baixar o CSV modelo (RF20)',
        produces: ['text/csv'],
        response: { 200: csvResponse('Cabeçalho e dois exemplos'), ...problemResponses(401) },
      },
    },
    (_request, reply) =>
      reply
        .type('text/csv; charset=utf-8')
        .header('content-disposition', 'attachment; filename="modelo-importacao-contatos.csv"')
        .send(IMPORT_TEMPLATE_CSV),
  );

  app.get(
    '/:id',
    {
      schema: {
        tags,
        summary: 'Status e contadores da importação (RF17)',
        params: byId,
        response: { 200: importSchema, ...problemResponses(401, 404) },
      },
    },
    (request) => getImport(imports, requireUser(request).id, request.params.id),
  );

  app.get(
    '/:id/errors',
    {
      schema: {
        tags,
        summary: 'Linhas com erro, paginadas (RF18)',
        description: 'Após o expurgo (RN15), `raw` é nulo e `rawPurged` é true.',
        params: byId,
        querystring: listImportErrorsQuerySchema,
        response: { 200: pageSchema(importErrorSchema), ...problemResponses(400, 401, 404) },
      },
    },
    (request) =>
      listImportErrors(imports, requireUser(request).id, request.params.id, request.query),
  );

  app.get(
    '/:id/errors.csv',
    {
      schema: {
        tags,
        summary: 'Baixar as linhas com erro em CSV, com a coluna motivo (RF19)',
        params: byId,
        produces: ['text/csv'],
        response: {
          200: csvResponse('Linhas originais + motivo, com células neutralizadas'),
          ...problemResponses(401, 404),
        },
      },
    },
    async (request, reply) => {
      const { fileName, lines } = await exportImportErrors(
        imports,
        requireUser(request).id,
        request.params.id,
      );
      return reply
        .type('text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="${fileName}"`)
        .send(Readable.from(lines));
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags,
        summary: 'Excluir importação e erros; contatos permanecem (RF23)',
        params: byId,
        response: { 204: noContent, ...problemResponses(401, 403, 404) },
      },
    },
    async (request, reply) => {
      await deleteImport(imports, requireUser(request).id, request.params.id);
      return reply.status(204).send(null);
    },
  );
};
