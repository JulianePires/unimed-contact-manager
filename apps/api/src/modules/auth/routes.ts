import {
  type LoginInput,
  loginInputSchema,
  registerInputSchema,
  userSchema,
} from '@contatos/contracts';
import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { FastifyPluginCallbackZod } from 'fastify-type-provider-zod';

import type { Env } from '@/shared/config/env';
import { AppError } from '@/shared/errors';
import { noContent, PUBLIC_ROUTE, problemResponses } from '@/shared/http/openapi';

import type { SessionPolicy } from './domain/session-policy';
import {
  clearSessionCookie,
  requireUser,
  type SessionCookie,
  sessionTokenOf,
  setSessionCookie,
} from './hooks';
import type { SessionsRepository } from './repositories/sessions';
import type { UsersRepository } from './repositories/users';
import { login } from './use-cases/login';
import { logout } from './use-cases/logout';
import { logoutAll } from './use-cases/logout-all';
import { me } from './use-cases/me';
import { register } from './use-cases/register';

export interface RateLimitRule {
  max: number;
  timeWindowMs: number;
}

export interface AuthRateLimits {
  perIp: RateLimitRule;
  perAccount: RateLimitRule;
}

export interface AuthConfig {
  cookie: SessionCookie;
  policy: SessionPolicy;
  rateLimits: AuthRateLimits;
}

const MINUTE_MS = 60_000;

/** Por IP em cadastro e login; por conta (e-mail) no login, contra força bruta distribuída. */
export const DEFAULT_AUTH_RATE_LIMITS: AuthRateLimits = {
  perIp: { max: 10, timeWindowMs: MINUTE_MS },
  perAccount: { max: 5, timeWindowMs: 15 * MINUTE_MS },
};

export function authConfigFromEnv(
  env: Pick<Env, 'NODE_ENV' | 'SESSION_COOKIE_NAME' | 'SESSION_IDLE_MINUTES' | 'SESSION_MAX_DAYS'>,
): AuthConfig {
  return {
    cookie: {
      name: env.SESSION_COOKIE_NAME,
      secure: env.NODE_ENV !== 'development',
      maxAgeSeconds: env.SESSION_MAX_DAYS * 24 * 60 * 60,
    },
    policy: { idleMinutes: env.SESSION_IDLE_MINUTES, maxDays: env.SESSION_MAX_DAYS },
    rateLimits: DEFAULT_AUTH_RATE_LIMITS,
  };
}

export interface AuthRoutesOptions {
  users: UsersRepository;
  sessions: SessionsRepository;
  policy: SessionPolicy;
  cookie: SessionCookie;
  rateLimits: AuthRateLimits;
  authenticate: preHandlerAsyncHookHandler;
  now: () => Date;
}

const clientOf = (request: FastifyRequest) => ({
  userAgent: request.headers['user-agent'],
  ip: request.ip,
});

/** E-mail (já validado) como chave do limite por conta: tentativas de vários IPs somam juntas. */
function accountKey(request: FastifyRequest): string {
  const { email } = request.body as LoginInput;
  return `login:${email.toLowerCase()}`;
}

/** Rotas de autenticação (docs/05 §5.3, ADR-006). */
export const authRoutes: FastifyPluginCallbackZod<AuthRoutesOptions> = (app, options, done) => {
  const { users, sessions, cookie, rateLimits, authenticate } = options;
  const sessionDeps = { sessions, policy: options.policy, now: options.now };
  const perIp = {
    rateLimit: { max: rateLimits.perIp.max, timeWindow: rateLimits.perIp.timeWindowMs },
  };
  // createRateLimit: o hook `rateLimit` roda uma vez por requisição e já é usado pelo limite por IP
  const checkAccount = app.createRateLimit({
    max: rateLimits.perAccount.max,
    timeWindow: rateLimits.perAccount.timeWindowMs,
    keyGenerator: accountKey,
  });
  const perAccount: preHandlerAsyncHookHandler = async (request, reply) => {
    const limit = await checkAccount(request);
    if (!limit.isAllowed && limit.isExceeded) {
      reply.header('retry-after', limit.ttlInSeconds);
      throw new AppError(429, 'RATE_LIMITED', 'Muitas tentativas. Tente novamente mais tarde.');
    }
  };

  const tags = ['auth'];

  app.post(
    '/register',
    {
      config: perIp,
      schema: {
        tags,
        summary: 'Criar conta e iniciar sessão (RF01)',
        ...PUBLIC_ROUTE,
        body: registerInputSchema,
        response: { 201: userSchema, ...problemResponses(409, 422, 429) },
      },
    },
    async (request, reply) => {
      const { user, sessionToken } = await register(
        { ...sessionDeps, users },
        request.body,
        clientOf(request),
      );
      setSessionCookie(reply, cookie, sessionToken);
      return reply.status(201).send(user);
    },
  );

  app.post(
    '/login',
    {
      config: perIp,
      preHandler: perAccount,
      schema: {
        tags,
        summary: 'Entrar (RF02)',
        description: 'Credenciais inválidas sempre recebem a mesma resposta genérica.',
        ...PUBLIC_ROUTE,
        body: loginInputSchema,
        response: { 200: userSchema, ...problemResponses(401, 422, 429) },
      },
    },
    async (request, reply) => {
      const { user, sessionToken } = await login(
        { ...sessionDeps, users },
        request.body,
        clientOf(request),
      );
      setSessionCookie(reply, cookie, sessionToken);
      return user;
    },
  );

  app.post(
    '/logout',
    {
      preHandler: authenticate,
      schema: {
        tags,
        summary: 'Sair da sessão atual (RF03)',
        response: { 204: noContent, ...problemResponses(401, 403) },
      },
    },
    async (request, reply) => {
      const token = sessionTokenOf(request, cookie);
      if (token !== undefined) await logout(sessions, token);
      clearSessionCookie(reply, cookie);
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/logout-all',
    {
      preHandler: authenticate,
      schema: {
        tags,
        summary: 'Sair de todas as sessões (RF03)',
        response: { 204: noContent, ...problemResponses(401, 403) },
      },
    },
    async (request, reply) => {
      await logoutAll(sessions, requireUser(request).id);
      clearSessionCookie(reply, cookie);
      return reply.status(204).send(null);
    },
  );

  app.get(
    '/me',
    {
      preHandler: authenticate,
      schema: {
        tags,
        summary: 'Usuário da sessão',
        response: { 200: userSchema, ...problemResponses(401) },
      },
    },
    (request) => me(requireUser(request)),
  );

  done();
};
