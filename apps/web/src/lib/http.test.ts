import { userSchema } from '@contatos/contracts';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API, problem, sessionUser } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';

import { ApiError, internalPath, loginUrl, request } from './http';

const ECHO = `${API}/echo`;

function captureRequests() {
  const received: Request[] = [];
  server.use(
    http.all(ECHO, ({ request: req }) => {
      received.push(req.clone());
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return received;
}

function respondWith(response: Response) {
  server.use(http.all(ECHO, () => response));
}

async function rejection(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('request: cabeçalhos', () => {
  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('envia o header CSRF em %s', async (method) => {
    const received = captureRequests();

    await request(method, ECHO, { body: { a: 1 } });

    expect(received[0]?.headers.get('X-Requested-With')).toBe('fetch');
    expect(received[0]?.headers.get('Content-Type')).toBe('application/json');
    expect(await received[0]?.json()).toEqual({ a: 1 });
  });

  it.each(['GET', 'HEAD'])('não envia o header CSRF em %s', async (method) => {
    const received = captureRequests();

    await request(method, ECHO);

    expect(received[0]?.headers.get('X-Requested-With')).toBeNull();
    expect(received[0]?.headers.get('Content-Type')).toBeNull();
    expect(received[0]?.headers.get('Accept')).toBe('application/json');
  });

  it('usa cookie de mesma origem', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    captureRequests();

    await request('GET', ECHO);

    expect(fetchSpy).toHaveBeenCalledWith(
      ECHO,
      expect.objectContaining({ credentials: 'same-origin' }),
    );
    fetchSpy.mockRestore();
  });

  it('envia FormData sem fixar content-type (o navegador define o boundary)', async () => {
    const received = captureRequests();
    const form = new FormData();
    form.append('file', new Blob(['nome;telefone'], { type: 'text/csv' }), 'contatos.csv');

    await request('POST', ECHO, { body: form });

    expect(received[0]?.headers.get('Content-Type')).toMatch(/^multipart\/form-data; boundary=/);
    expect(received[0]?.headers.get('X-Requested-With')).toBe('fetch');
  });

  it('repassa o sinal de cancelamento', async () => {
    captureRequests();
    const controller = new AbortController();
    controller.abort();

    await expect(request('GET', ECHO, { signal: controller.signal })).rejects.toThrow();
  });
});

describe('request: respostas', () => {
  it('valida e tipa o corpo com o schema dos contracts', async () => {
    respondWith(HttpResponse.json(sessionUser));

    await expect(request('GET', ECHO, { schema: userSchema })).resolves.toEqual(sessionUser);
  });

  it('rejeita corpo fora do contrato', async () => {
    respondWith(HttpResponse.json({ id: 'x' }));

    await expect(request('GET', ECHO, { schema: userSchema })).rejects.toThrow();
  });

  it('não lê corpo sem schema (204)', async () => {
    captureRequests();

    await expect(request('POST', ECHO)).resolves.toBeUndefined();
  });
});

describe('request: Problem Details', () => {
  it('converte o problema em ApiError com code, errors e campos extras', async () => {
    respondWith(
      problem('VALIDATION_ERROR', 'Dados inválidos', {
        errors: [{ field: 'phone', code: 'INVALID_PHONE', message: 'Telefone inválido' }],
      }),
    );

    const error = await rejection(request('POST', ECHO, { body: {} }));

    expect(error).toMatchObject({
      name: 'ApiError',
      message: 'Dados inválidos',
      status: 422,
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'phone', code: 'INVALID_PHONE', message: 'Telefone inválido' }],
    });
  });

  it('preserva os campos extras do problema', async () => {
    respondWith(
      problem('MOBILE_ALREADY_EXISTS', 'Celular já cadastrado', {
        contactId: '0192f3a1-0000-7000-8000-000000000002',
      }),
    );

    const error = await rejection(request('POST', ECHO, { body: {} }));

    expect(error.code).toBe('MOBILE_ALREADY_EXISTS');
    expect(error.errors).toEqual([]);
    expect(error.extras).toMatchObject({ contactId: '0192f3a1-0000-7000-8000-000000000002' });
  });

  it.each([
    [500, 'INTERNAL_ERROR'],
    [502, 'INTERNAL_ERROR'],
    [404, 'BAD_REQUEST'],
  ])('erro %i sem Problem Details vira ApiError genérico %s', async (status, code) => {
    respondWith(new HttpResponse('falha', { status, headers: { 'content-type': 'text/plain' } }));

    const error = await rejection(request('GET', ECHO));

    expect(error).toMatchObject({ status, code, message: 'Erro inesperado' });
  });

  it('problem+json fora do contrato vira ApiError genérico', async () => {
    respondWith(
      HttpResponse.json(
        { title: 'sem code' },
        { status: 400, headers: { 'content-type': 'application/problem+json' } },
      ),
    );

    const error = await rejection(request('GET', ECHO));

    expect(error).toMatchObject({ status: 400, code: 'BAD_REQUEST' });
  });
});

describe('request: sessão expirada (401)', () => {
  const assign = vi.fn();

  function stubLocation(pathname: string, search = '') {
    const url = new URL(`${pathname}${search}`, window.location.origin);
    vi.stubGlobal('location', { href: url.href, origin: url.origin, pathname, search, assign });
  }

  beforeEach(() => {
    assign.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('leva ao login com a rota atual em redirect', async () => {
    stubLocation('/contatos', '?q=ana&page=2');
    respondWith(problem('UNAUTHENTICATED', 'Sessão expirada'));

    const error = await rejection(request('GET', ECHO));

    expect(error.code).toBe('UNAUTHENTICATED');
    expect(assign).toHaveBeenCalledWith('/entrar?redirect=%2Fcontatos%3Fq%3Dana%26page%3D2');
  });

  it('não redireciona quando já está no login', async () => {
    stubLocation('/entrar');
    respondWith(problem('UNAUTHENTICATED', 'Sessão expirada'));

    await rejection(request('GET', ECHO));

    expect(assign).not.toHaveBeenCalled();
  });

  it('não redireciona quando quem chama trata o 401', async () => {
    stubLocation('/contatos');
    respondWith(problem('UNAUTHENTICATED', 'Sessão expirada'));

    await rejection(request('GET', ECHO, { redirectOnUnauthorized: false }));

    expect(assign).not.toHaveBeenCalled();
  });

  it('credenciais inválidas no login não redirecionam', async () => {
    stubLocation('/entrar');
    respondWith(problem('INVALID_CREDENTIALS', 'E-mail ou senha inválidos'));

    const error = await rejection(request('POST', ECHO, { body: {} }));

    expect(error).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS' });
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('internalPath / loginUrl', () => {
  it.each(['/contatos', '/contatos?q=ana', '/importacoes/123#erros', '/'])('aceita %s', (value) => {
    expect(internalPath(value)).toBe(value);
  });

  it.each([
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'contatos',
    '',
    undefined,
    42,
  ])('recusa %s', (value) => {
    expect(internalPath(value)).toBeUndefined();
  });

  it('monta o login com redirect apenas para caminho interno', () => {
    expect(loginUrl('/contatos?q=ana')).toBe('/entrar?redirect=%2Fcontatos%3Fq%3Dana');
    expect(loginUrl('//evil.example')).toBe('/entrar');
  });
});
