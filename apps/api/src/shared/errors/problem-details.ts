import { type ErrorCode, type ProblemDetails, problemType } from '@contatos/contracts';

import { AppError } from './app-error';

/** Erros HTTP do próprio Fastify (corpo inválido, limite de tamanho…) por status. */
const HTTP_ERRORS: Partial<Record<number, { code: ErrorCode; title: string }>> = {
  400: { code: 'BAD_REQUEST', title: 'Requisição inválida' },
  404: { code: 'NOT_FOUND', title: 'Recurso não encontrado' },
  413: { code: 'FILE_TOO_LARGE', title: 'Conteúdo muito grande' },
  415: { code: 'UNSUPPORTED_FILE_TYPE', title: 'Tipo de conteúdo não suportado' },
  429: { code: 'RATE_LIMITED', title: 'Muitas requisições' },
};

const INTERNAL = { status: 500, code: 'INTERNAL_ERROR', title: 'Erro interno' } as const;

function httpStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return undefined;
  return typeof error.statusCode === 'number' ? error.statusCode : undefined;
}

/**
 * Converte qualquer erro em Problem Details (RFC 9457, docs/05 §5.2). Erros inesperados viram
 * 500 sem detalhes internos.
 */
export function toProblemDetails(
  error: unknown,
  context: { instance: string; requestId: string },
): ProblemDetails {
  const base = { instance: context.instance, requestId: context.requestId };

  if (error instanceof AppError) {
    return {
      ...error.extras,
      type: problemType(error.code),
      title: error.title,
      status: error.status,
      code: error.code,
      ...base,
    };
  }

  const status = httpStatus(error);
  const known = status === undefined ? undefined : HTTP_ERRORS[status];
  if (status !== undefined && known) {
    return { type: problemType(known.code), title: known.title, status, code: known.code, ...base };
  }

  return { type: problemType(INTERNAL.code), ...INTERNAL, ...base };
}
