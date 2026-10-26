import { describe, expect, it } from 'vitest';

import { apiErrorMessage, errorMessages, fieldDomId } from './form';
import { ApiError } from './http';

describe('errorMessages', () => {
  it('junta strings e issues do Standard Schema, inclusive aninhadas, sem repetir', () => {
    expect(
      errorMessages([
        'Informe o e-mail.',
        [{ message: 'Informe o e-mail.' }, { message: 'Informe um e-mail válido.' }],
        { message: 'A senha deve ter ao menos 12 caracteres.', path: ['password'] },
      ]),
    ).toEqual([
      'Informe o e-mail.',
      'Informe um e-mail válido.',
      'A senha deve ter ao menos 12 caracteres.',
    ]);
  });

  it('ignora valores sem mensagem legível', () => {
    expect(errorMessages([undefined, null, 42, { message: 42 }, { code: 'X' }])).toEqual([]);
  });
});

describe('apiErrorMessage', () => {
  const messages = { INVALID_CREDENTIALS: 'E-mail ou senha inválidos.' };

  it('usa o texto definido para o código', () => {
    const error = new ApiError({
      type: 'about:blank',
      title: 'Credenciais',
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });

    expect(apiErrorMessage(error, messages, 'Genérica')).toBe('E-mail ou senha inválidos.');
  });

  it('cai na mensagem genérica para outros códigos e erros que não são da API', () => {
    const error = new ApiError({
      type: 'about:blank',
      title: 'Detalhe técnico',
      status: 500,
      code: 'INTERNAL_ERROR',
    });

    expect(apiErrorMessage(error, messages, 'Genérica')).toBe('Genérica');
    expect(apiErrorMessage(new TypeError('Failed to fetch'), messages, 'Genérica')).toBe(
      'Genérica',
    );
  });
});

it('fieldDomId combina formulário e campo', () => {
  expect(fieldDomId('login', 'email')).toBe('login-email');
});
