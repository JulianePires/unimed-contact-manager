import { toFieldErrors } from '@contatos/contracts';
import type { FastifySchemaCompiler } from 'fastify';
import type { z } from 'zod';

import { AppError } from '@/shared/errors';

/** Falha de validação no contrato da API (docs/05 §5.2): corpo → 422; query/params/headers → 400. */
export function validationError(httpPart: string | undefined, error: z.core.$ZodError): AppError {
  const errors = toFieldErrors(error);
  return httpPart === 'body'
    ? new AppError(422, 'VALIDATION_ERROR', 'Dados inválidos', { errors })
    : new AppError(400, 'BAD_REQUEST', 'Parâmetros inválidos', { errors });
}

/**
 * Validação nativa do Fastify com os schemas Zod de `@contatos/contracts` (ADR-007). O handler
 * recebe o valor já normalizado (ex.: celular em E.164); a falha chega ao handler central como
 * `AppError`, preservando os códigos por campo de `errors[]`.
 */
export const validatorCompiler: FastifySchemaCompiler<z.ZodType> =
  ({ schema, httpPart }) =>
  (data) => {
    const result = schema.safeParse(data);
    return result.success
      ? { value: result.data }
      : { error: validationError(httpPart, result.error) };
  };
