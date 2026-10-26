import type { User } from '@contatos/contracts';
import type {
  FastifyReply,
  FastifyRequest,
  onRequestHookHandler,
  preHandlerAsyncHookHandler,
} from 'fastify';

import { AppError } from '@/shared/errors';

import {
  type SessionPolicy,
  TOUCH_INTERVAL_MS,
  sessionExpiresAt,
  shouldTouchSession,
} from './domain/session-policy';
import type { SessionsRepository } from './repositories/sessions';

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
  }
}

export const CSRF_HEADER = 'x-requested-with';
export const CSRF_HEADER_VALUE = 'fetch';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Mutações exigem `X-Requested-With: fetch`: formulários cross-site não definem o header (ADR-006). */
export const requireCsrfHeader: onRequestHookHandler = (request, _reply, done) => {
  if (!SAFE_METHODS.has(request.method) && request.headers[CSRF_HEADER] !== CSRF_HEADER_VALUE) {
    done(new AppError(403, 'CSRF_HEADER_MISSING', 'Cabeçalho de segurança ausente'));
    return;
  }
  done();
};

export interface SessionCookie {
  name: string;
  secure: boolean;
  maxAgeSeconds: number;
}

export function setSessionCookie(reply: FastifyReply, cookie: SessionCookie, token: string): void {
  reply.setCookie(cookie.name, token, {
    httpOnly: true,
    secure: cookie.secure,
    sameSite: 'lax',
    path: '/',
    maxAge: cookie.maxAgeSeconds,
  });
}

export function clearSessionCookie(reply: FastifyReply, cookie: SessionCookie): void {
  reply.clearCookie(cookie.name, {
    httpOnly: true,
    secure: cookie.secure,
    sameSite: 'lax',
    path: '/',
  });
}

export function sessionTokenOf(request: FastifyRequest, cookie: SessionCookie): string | undefined {
  return request.cookies[cookie.name];
}

export interface AuthenticateDeps {
  sessions: SessionsRepository;
  policy: SessionPolicy;
  cookie: SessionCookie;
  now: () => Date;
}

/** Exige sessão válida e decora `request.user`; renova a expiração no máximo 1×/min. */
export function createAuthenticate({
  sessions,
  policy,
  cookie,
  now,
}: AuthenticateDeps): preHandlerAsyncHookHandler {
  return async (request, reply) => {
    const token = sessionTokenOf(request, cookie);
    const current = now();
    const session = token === undefined ? undefined : await sessions.findActive(token, current);
    if (!session) {
      if (token !== undefined) clearSessionCookie(reply, cookie);
      throw new AppError(401, 'UNAUTHENTICATED', 'Sessão inválida ou expirada');
    }
    if (shouldTouchSession(session.lastSeenAt, current)) {
      await sessions.touch(session.idHash, {
        now: current,
        expiresAt: sessionExpiresAt(policy, { createdAt: session.createdAt, lastSeenAt: current }),
        touchedBefore: new Date(current.getTime() - TOUCH_INTERVAL_MS + 1),
      });
    }
    request.user = session.user;
  };
}
