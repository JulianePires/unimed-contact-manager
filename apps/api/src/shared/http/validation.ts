import { toFieldErrors } from '@contatos/contracts';
import type { z } from 'zod';

import { AppError } from '@/shared/errors';

/** Valida o corpo pelo schema dos contracts; falha vira 422 com `errors[]` (docs/05 §5.2). */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Dados inválidos', {
      errors: toFieldErrors(result.error),
    });
  }
  return result.data;
}

/** Valida a query string; parâmetro inválido vira 400 com `errors[]` (docs/05 §5.2). */
export function parseQuery<T extends z.ZodType>(schema: T, query: unknown): z.output<T> {
  const result = schema.safeParse(query);
  if (!result.success) {
    throw new AppError(400, 'BAD_REQUEST', 'Parâmetros inválidos', {
      errors: toFieldErrors(result.error),
    });
  }
  return result.data;
}
