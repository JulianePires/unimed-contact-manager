import { problemDetailsSchema } from '@contatos/contracts';
import { describe, expect, it } from 'vitest';

import { AppError } from './app-error';
import { toProblemDetails } from './problem-details';

const context = { instance: '/api/v1/contacts', requestId: 'req-1' };

describe('toProblemDetails', () => {
  it('converte AppError mantendo status, código e extras', () => {
    const error = new AppError(409, 'MOBILE_ALREADY_EXISTS', 'Celular já cadastrado', {
      contactId: '0192f',
    });

    expect(toProblemDetails(error, context)).toEqual({
      type: 'https://contatos.app/problems/mobile-already-exists',
      title: 'Celular já cadastrado',
      status: 409,
      code: 'MOBILE_ALREADY_EXISTS',
      contactId: '0192f',
      instance: '/api/v1/contacts',
      requestId: 'req-1',
    });
  });

  it('extras não sobrescrevem os campos do problema', () => {
    const error = new AppError(404, 'NOT_FOUND', 'Não encontrado', { status: 200, code: 'X' });

    expect(toProblemDetails(error, context)).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it.each([
    [400, 'BAD_REQUEST'],
    [413, 'FILE_TOO_LARGE'],
    [415, 'UNSUPPORTED_FILE_TYPE'],
    [429, 'RATE_LIMITED'],
  ])('mapeia erro HTTP %i do Fastify para %s', (statusCode, code) => {
    const error = Object.assign(new Error('fastify'), { statusCode });

    expect(toProblemDetails(error, context)).toMatchObject({ status: statusCode, code });
  });

  it.each([
    ['erro inesperado', new Error('senha do banco: 123')],
    ['status HTTP sem mapeamento', Object.assign(new Error('x'), { statusCode: 418 })],
    ['statusCode que não é número', Object.assign(new Error('x'), { statusCode: '404' })],
    ['valor que não é erro', 'boom'],
  ])('%s vira 500 sem detalhes internos', (_, error) => {
    const problem = toProblemDetails(error, context);

    expect(problem).toMatchObject({ status: 500, code: 'INTERNAL_ERROR', title: 'Erro interno' });
    expect(JSON.stringify(problem)).not.toContain('senha');
  });

  it('produz um Problem Details válido pelo contrato compartilhado', () => {
    const problem = toProblemDetails(new Error('x'), context);

    expect(problemDetailsSchema.safeParse(problem).success).toBe(true);
  });
});
