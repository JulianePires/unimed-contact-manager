import {
  type Import,
  importErrorSchema,
  importSchema,
  isTerminalImportStatus,
  PAGE_SIZE_DEFAULT,
  pageSchema,
} from '@contatos/contracts';
import { type QueryClient, queryOptions } from '@tanstack/react-query';
import { notFound } from '@tanstack/react-router';
import { z } from 'zod';

import { ApiError, request } from '@/lib/http';

const IMPORTS_PATH = '/api/v1/imports';
const importPageSchema = pageSchema(importSchema);
const importErrorPageSchema = pageSchema(importErrorSchema);

/** RN10: até 5 MB. No cliente é só UX; a API é a autoridade (ADR-008). */
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** Intervalo do acompanhamento (UC13, ADR-002). */
export const IMPORT_POLL_INTERVAL_MS = 2000;

export const TEMPLATE_CSV_URL = `${IMPORTS_PATH}/template.csv`;

export function errorsCsvUrl(id: string): string {
  return `${IMPORTS_PATH}/${id}/errors.csv`;
}

export function isActive(item: Pick<Import, 'status'>): boolean {
  return !isTerminalImportStatus(item.status);
}

export function importsQueryOptions(page: number) {
  return queryOptions({
    queryKey: ['imports', { page }],
    queryFn: ({ signal }) =>
      request('GET', `${IMPORTS_PATH}?page=${String(page)}&pageSize=${String(PAGE_SIZE_DEFAULT)}`, {
        schema: importPageSchema,
        signal,
      }),
    // Repete a cada 2 s enquanto houver importação não terminal; para sozinho depois
    refetchInterval: ({ state }) =>
      state.data?.data.some(isActive) ? IMPORT_POLL_INTERVAL_MS : false,
  });
}

export function importQueryOptions(id: string) {
  return queryOptions({
    queryKey: ['import', id],
    queryFn: ({ signal }) =>
      request('GET', `${IMPORTS_PATH}/${id}`, { schema: importSchema, signal }),
    refetchInterval: ({ state }) =>
      state.data && isActive(state.data) ? IMPORT_POLL_INTERVAL_MS : false,
  });
}

export function importErrorsQueryOptions(id: string, page: number) {
  return queryOptions({
    queryKey: ['import-errors', id, page],
    queryFn: ({ signal }) =>
      request('GET', `${IMPORTS_PATH}/${id}/errors?page=${String(page)}`, {
        schema: importErrorPageSchema,
        signal,
      }),
  });
}

/** `force` reprocessa um arquivo já importado, após confirmação (RF22, ADR-002). */
export function uploadImport(file: File, { force = false } = {}): Promise<Import> {
  const body = new FormData();
  body.append('file', file);
  return request('POST', `${IMPORTS_PATH}${force ? '?force=true' : ''}`, {
    body,
    schema: importSchema,
  });
}

/** Remove a importação e as linhas com erro; os contatos criados permanecem (RF23). */
export function deleteImport(id: string): Promise<void> {
  return request('DELETE', `${IMPORTS_PATH}/${id}`);
}

const importIdSchema = z.uuid();

/** Inexistente, de outra conta ou excluída viram a mesma tela "Importação não encontrada". */
export async function loadImport(queryClient: QueryClient, id: string): Promise<Import> {
  if (!importIdSchema.safeParse(id).success) notFound({ throw: true });
  try {
    return await queryClient.query(importQueryOptions(id));
  } catch (error) {
    if (error instanceof ApiError && error.code === 'NOT_FOUND') notFound({ throw: true });
    throw error;
  }
}
