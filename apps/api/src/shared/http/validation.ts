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
