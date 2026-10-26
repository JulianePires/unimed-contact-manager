import {
  type ErrorCode,
  type FieldError,
  type ProblemDetails,
  problemDetailsSchema,
} from '@contatos/contracts';
import type { z } from 'zod';

export const LOGIN_PATH = '/entrar';
const CSRF_HEADER = { 'X-Requested-With': 'fetch' };
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Erro da API em Problem Details (docs/05 §5.2), com o `code` estável dos contracts. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly errors: FieldError[];
  /** Campos extras do problema (ex.: `contactId`, `importId`). */
  readonly extras: Record<string, unknown>;

  constructor(problem: ProblemDetails) {
    const { title, status, code, errors, ...extras } = problem;
    super(title);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors ?? [];
    this.extras = extras;
  }
}

/**
 * `redirect` pós-login só aceita caminhos internos (docs/06 §6.8): começa com uma única `/` e não
 * vira URL de outro host (`//evil`, `/\evil`).
 */
export function internalPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/')) return undefined;
  if (value.startsWith('//') || value.startsWith('/\\')) return undefined;
  return value;
}

export function loginUrl(redirect: string): string {
  const target = internalPath(redirect);
  return target ? `${LOGIN_PATH}?redirect=${encodeURIComponent(target)}` : LOGIN_PATH;
}

/** Sessão ausente ou expirada: recarrega no login, o que também descarta o cache em memória. */
function redirectToLogin(): void {
  const { pathname, search } = window.location;
  if (pathname === LOGIN_PATH) return;
  window.location.assign(loginUrl(`${pathname}${search}`));
}

async function toApiError(response: Response): Promise<ApiError> {
  const isProblem = response.headers.get('content-type')?.includes('application/problem+json');
  const parsed = isProblem ? problemDetailsSchema.safeParse(await response.json()) : undefined;
  if (parsed?.success) return new ApiError(parsed.data);
  return new ApiError({
    type: 'about:blank',
    title: 'Erro inesperado',
    status: response.status,
    code: response.status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
  });
}

export interface RequestOptions {
  /** JSON ou FormData (upload); FormData define o próprio content-type. */
  body?: unknown;
  signal?: AbortSignal;
  /** `false` quando quem chama trata o 401 (ex.: o guard de rota faz o redirect). */
  redirectOnUnauthorized?: boolean;
}

/**
 * Cliente único da API (docs/06 §6.4): mesma origem com cookie, header CSRF em métodos não
 * seguros, Problem Details → `ApiError` e sessão expirada (401 UNAUTHENTICATED) → login.
 * Com `schema`, a resposta é validada e tipada pelos contracts; sem ele (204), nada é lido.
 */
export async function request<T>(
  method: string,
  path: string,
  options: RequestOptions & { schema: z.ZodType<T> },
): Promise<T>;
export async function request(
  method: string,
  path: string,
  options?: RequestOptions,
): Promise<void>;
export async function request<T>(
  method: string,
  path: string,
  {
    body,
    signal,
    redirectOnUnauthorized = true,
    schema,
  }: RequestOptions & { schema?: z.ZodType<T> } = {},
): Promise<T | undefined> {
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(SAFE_METHODS.has(method) ? {} : CSRF_HEADER),
    ...(body === undefined || isForm ? {} : { 'Content-Type': 'application/json' }),
  };
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    ...(body === undefined ? {} : { body: isForm ? body : JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    const error = await toApiError(response);
    if (error.code === 'UNAUTHENTICATED' && redirectOnUnauthorized) redirectToLogin();
    throw error;
  }
  return schema?.parse(await response.json());
}
