import { z } from 'zod';

import { fieldErrorSchema } from './errors';
import { isoDateTimeSchema } from './fields';
import { paginationQuerySchema } from './pagination';

/** Ciclo da importação (RN14): PENDING → PROCESSING → COMPLETED | COMPLETED_WITH_ERRORS | FAILED. */
export const ImportStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  COMPLETED_WITH_ERRORS: 'COMPLETED_WITH_ERRORS',
  FAILED: 'FAILED',
} as const;
export type ImportStatus = (typeof ImportStatus)[keyof typeof ImportStatus];

export const importStatusSchema = z.enum(ImportStatus);

const TERMINAL_STATUSES: ReadonlySet<ImportStatus> = new Set([
  ImportStatus.COMPLETED,
  ImportStatus.COMPLETED_WITH_ERRORS,
  ImportStatus.FAILED,
]);

/** Status final: o front encerra o polling. */
export function isTerminalImportStatus(status: ImportStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

const counterSchema = z.int().min(0);

export const importSchema = z.object({
  id: z.uuid(),
  fileName: z.string(),
  status: importStatusSchema,
  totalRows: counterSchema,
  processedRows: counterSchema,
  createdCount: counterSchema,
  skippedCount: counterSchema,
  failedCount: counterSchema,
  failureReason: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  startedAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
});
export type Import = z.infer<typeof importSchema>;

/** Linha com erro; após o expurgo (RN15), `raw` é `null` e `rawPurged` é `true`. */
export const importErrorSchema = z.object({
  lineNumber: z.int().min(2),
  raw: z.record(z.string(), z.string()).nullable(),
  rawPurged: z.boolean().optional(),
  errors: z.array(fieldErrorSchema).min(1),
});
export type ImportError = z.infer<typeof importErrorSchema>;

export const listImportsQuerySchema = paginationQuerySchema;
export type ListImportsQuery = z.output<typeof listImportsQuerySchema>;

export const listImportErrorsQuerySchema = paginationQuerySchema;
export type ListImportErrorsQuery = z.output<typeof listImportErrorsQuerySchema>;
