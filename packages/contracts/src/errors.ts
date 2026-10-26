import { z } from 'zod';

import {
  type ErrorCode,
  errorCodeSchema,
  FieldErrorCode,
  fieldErrorCodeSchema,
} from './error-codes';

/** Item de `errors[]` em respostas 422; `firstLine` acompanha `DUPLICATE_IN_FILE`. */
export const fieldErrorSchema = z.object({
  field: z.string(),
  code: fieldErrorCodeSchema,
  message: z.string(),
  firstLine: z.int().min(2).optional(),
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

function fieldErrorCode(issue: z.core.$ZodIssue): FieldErrorCode {
  const parsed = fieldErrorCodeSchema.safeParse(issue.code === 'custom' && issue.params?.['code']);
  if (parsed.success) return parsed.data;
  return issue.code === 'invalid_type' ? FieldErrorCode.REQUIRED : FieldErrorCode.INVALID_VALUE;
}

/** Converte a falha de validação de um schema dos contracts em `errors[]` do 422. */
export function toFieldErrors(error: z.core.$ZodError): FieldError[] {
  return error.issues.flatMap((issue) => {
    const field = issue.path.join('.');
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        field: field ? `${field}.${key}` : key,
        code: FieldErrorCode.UNKNOWN_FIELD,
        message: 'Campo não permitido.',
      }));
    }
    return [{ field, code: fieldErrorCode(issue), message: issue.message }];
  });
}
