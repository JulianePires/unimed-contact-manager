import {
  type ErrorCode,
  ERROR_STATUS,
  problemDetailsSchema,
  problemType,
  toFieldErrors,
} from '@contatos/contracts';
import { HttpResponse } from 'msw';
import type { z } from 'zod';

/** Resposta de erro igual à da API: Problem Details com o status do código (docs/05 §5.2). */
export function problem(code: ErrorCode, title: string, extras: Record<string, unknown> = {}) {
  const status = ERROR_STATUS[code];
  return HttpResponse.json(
    problemDetailsSchema.parse({ type: problemType(code), title, status, code, ...extras }),
    { status, headers: { 'content-type': 'application/problem+json' } },
  );
}

/** Corpo validado pelo schema dos contracts; inválido → 422 com `errors[]`, como a API. */
export async function parseBody<T extends z.ZodType>(request: Request, schema: T) {
  const result = schema.safeParse(await request.json());
  return result.success
    ? { ok: true as const, data: result.data }
    : {
        ok: false as const,
        response: problem('VALIDATION_ERROR', 'Dados inválidos', {
          errors: toFieldErrors(result.error),
        }),
      };
}
