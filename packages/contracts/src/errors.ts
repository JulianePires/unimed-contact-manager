import { z } from 'zod';

/** Códigos de erro da API (docs/05 §5.2). */
export const ERROR_CODES = [
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'CSRF_HEADER_MISSING',
  'NOT_FOUND',
  'MOBILE_ALREADY_EXISTS',
  'MOBILE_BELONGS_TO_INACTIVE_CONTACT',
  'CONTACT_MUST_BE_INACTIVE',
  'CONTACT_ANONYMIZED',
  'IMPORT_ALREADY_EXISTS',
  'REGISTRATION_FAILED',
  'CONTACT_MODIFIED',
  'FILE_TOO_LARGE',
  'UNSUPPORTED_FILE_TYPE',
  'VALIDATION_ERROR',
  'PRECONDITION_REQUIRED',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Item de `errors[]` em respostas 422. */
export const fieldErrorSchema = z.object({
  field: z.string(),
  code: z.string(),
  message: z.string(),
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

/** Problem Details (RFC 9457) com `code` e extras por erro (ex.: `contactId`). */
export const problemDetailsSchema = z.looseObject({
  type: z.url(),
  title: z.string(),
  status: z.int().min(400).max(599),
  code: errorCodeSchema,
  detail: z.string().optional(),
  instance: z.string().optional(),
  requestId: z.string().optional(),
  errors: z.array(fieldErrorSchema).optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

/** URI do `type` a partir do código: `MOBILE_ALREADY_EXISTS` → `…/problems/mobile-already-exists`. */
export function problemType(code: ErrorCode): string {
  return `https://contatos.app/problems/${code.toLowerCase().replaceAll('_', '-')}`;
}
