import { createHash } from 'node:crypto';

import { problemDetailsSchema, userSchema } from '@contatos/contracts';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { AuthRateLimits } from '@/modules/auth/routes';
import { createDatabase, type Database } from '@/shared/db/client';
import { sessions } from '@/shared/db/schema';

import {
  buildTestApp,
  CSRF_HEADERS,
  newRegistration,
  registerUser,
  type TestApp,
  testAuthConfig,
} from '../helpers/app';
import { startMigratedPostgres, truncateAll } from '../helpers/db-container';

let container: StartedPostgreSqlContainer;
let db: Database;
let app: TestApp;
let clock: Date;

const MINUTE_MS = 60_000;
const advance = (minutes: number) => {
  clock = new Date(clock.getTime() + minutes * MINUTE_MS);
};

async function startApp(rateLimits?: AuthRateLimits) {
  app = await buildTestApp(db, {
    now: () => clock,
    ...(rateLimits && { auth: { ...testAuthConfig, rateLimits } }),
  });
}

beforeAll(async () => {
  container = await startMigratedPostgres();
  db = createDatabase(container.getConnectionUri());
});

afterAll(async () => {
  await db.close();
  await container.stop();
});

beforeEach(async () => {
  await truncateAll(db.orm);
  clock = new Date('2026-10-26T12:00:00.000Z');
  await startApp();
});

afterEach(async () => {
  await app.close();
});

const post = (url: string, payload?: object, headers: Record<string, string> = CSRF_HEADERS) =>
  app.inject({ method: 'POST', url: `/api/v1/auth${url}`, headers, ...(payload && { payload }) });

const me = (cookie?: string) =>
  app.inject({
    method: 'GET',
    url: '/api/v1/auth/me',
    ...(cookie !== undefined && { headers: { cookie } }),
  });

const problemOf = (body: string) => problemDetailsSchema.parse(JSON.parse(body));

describe('POST /auth/register (RF01)', () => {
  it('dado dados válidos, então responde 201 com o usuário e o cookie de sessão seguro', async () => {
    const registration = newRegistration();

    const response = await post('/register', registration);

    expect(response.statusCode).toBe(201);
    expect(userSchema.strict().parse(response.json())).toMatchObject({
      name: registration.name,
      email: registration.email,
    });
    const setCookie = String(response.headers['set-cookie']);
    expect(setCookie).toMatch(/^__Host-sid=[\w-]{43};/);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
  });

  it('dado e-mail já cadastrado (sem diferenciar caixa), então responde 409 genérico', async () => {
    const registration = newRegistration();
    await registerUser(app, registration);

    const response = await post('/register', {
      ...newRegistration(),
      email: registration.email.toUpperCase(),
    });

    expect(response.statusCode).toBe(409);
    expect(problemOf(response.body)).toMatchObject({ code: 'REGISTRATION_FAILED' });
    expect(response.body).not.toContain(registration.email);
  });

  it('dado senha fraca, então responde 422 com o erro no campo password', async () => {
    const response = await post('/register', newRegistration({ password: 'curta' }));

    expect(response.statusCode).toBe(422);
    expect(problemOf(response.body)).toMatchObject({
      code: 'VALIDATION_ERROR',
      errors: [expect.objectContaining({ field: 'password', code: 'PASSWORD_TOO_SHORT' })],
    });
  });
});

describe('POST /auth/login (RF02)', () => {
  it('dado credenciais válidas, então responde 200 com um novo ID de sessão', async () => {
    const registration = newRegistration();
    const { cookie: registrationCookie } = await registerUser(app, registration);

    const response = await post('/login', {
      email: registration.email,
      password: registration.password,
    });

    expect(response.statusCode).toBe(200);
    const [sessionCookie] = response.cookies;
    expect(sessionCookie?.value).toBeDefined();
    expect(`${sessionCookie?.name}=${sessionCookie?.value}`).not.toBe(registrationCookie);
  });

  it.each([
    ['senha errada', (email: string) => ({ email, password: 'senha-errada-123' })],
    ['e-mail inexistente', () => ({ email: 'ninguem@exemplo.com', password: 'senha-forte-123' })],
  ])('dado %s, então responde 401 com a mesma mensagem genérica', async (_, credentials) => {
    const registration = newRegistration();
    await registerUser(app, registration);

    const response = await post('/login', credentials(registration.email));

    expect(response.statusCode).toBe(401);
    expect(problemOf(response.body)).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      title: 'E-mail ou senha inválidos',
    });
    expect(response.headers['set-cookie']).toBeUndefined();
  });
});

describe('GET /auth/me (RF04)', () => {
  it('dado sem cookie, então responde 401', async () => {
    const response = await me();

    expect(response.statusCode).toBe(401);
    expect(problemOf(response.body)).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('dado cookie de sessão válido, então responde o usuário', async () => {
    const { user, cookie } = await registerUser(app);

    const response = await me(cookie);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(user);
  });

  it('dado cookie forjado, então responde 401', async () => {
    expect((await me('__Host-sid=forjado')).statusCode).toBe(401);
  });
});

describe('expiração da sessão (ADR-006)', () => {
  it('dado 2 h sem atividade, então a sessão expira', async () => {
    const { cookie } = await registerUser(app);

    advance(121);

    expect((await me(cookie)).statusCode).toBe(401);
  });

  it('dado atividade dentro do prazo, então a expiração desliza', async () => {
    const { cookie } = await registerUser(app);

    advance(100);
    expect((await me(cookie)).statusCode).toBe(200);
    advance(100);

    expect((await me(cookie)).statusCode).toBe(200);
  });

  it('dado atividade contínua, então expira no limite absoluto de 7 dias', async () => {
    const { cookie } = await registerUser(app);

    for (let elapsed = 0; elapsed < 7 * 24 * 60 - 100; elapsed += 100) {
      advance(100);
      expect((await me(cookie)).statusCode).toBe(200);
    }
    advance(100);

    expect((await me(cookie)).statusCode).toBe(401);
  });
});

describe('POST /auth/logout e /auth/logout-all (RF03)', () => {
  it('dado logout, então a sessão é invalidada e o cookie é limpo', async () => {
    const { cookie } = await registerUser(app);

    const response = await post('/logout', undefined, { ...CSRF_HEADERS, cookie });

    expect(response.statusCode).toBe(204);
    expect(String(response.headers['set-cookie'])).toMatch(/^__Host-sid=;/);
    expect((await me(cookie)).statusCode).toBe(401);
  });

  it('dado logout-all, então todas as sessões do usuário são invalidadas', async () => {
    const registration = newRegistration();
    const { cookie: first } = await registerUser(app, registration);
    const login = await post('/login', {
      email: registration.email,
      password: registration.password,
    });
    const [secondCookie] = login.cookies;
    const second = `${secondCookie?.name}=${secondCookie?.value}`;
    const other = await registerUser(app);

    const response = await post('/logout-all', undefined, { ...CSRF_HEADERS, cookie: first });

    expect(response.statusCode).toBe(204);
    expect((await me(first)).statusCode).toBe(401);
    expect((await me(second)).statusCode).toBe(401);
    expect((await me(other.cookie)).statusCode).toBe(200);
  });

  it('dado logout sem sessão, então responde 401', async () => {
    expect((await post('/logout')).statusCode).toBe(401);
  });
});

describe('CSRF (RNF03)', () => {
  it.each([
    ['sem o header', {}],
    ['com valor diferente', { 'x-requested-with': 'XMLHttpRequest' }],
  ])('dado POST %s, então responde 403', async (_, headers) => {
    const response = await post('/register', newRegistration(), headers);

    expect(response.statusCode).toBe(403);
    expect(problemOf(response.body)).toMatchObject({ code: 'CSRF_HEADER_MISSING' });
  });

  it('dado GET sem o header, então não exige', async () => {
    const { cookie } = await registerUser(app);

    expect((await me(cookie)).statusCode).toBe(200);
  });
});

describe('rate limit (RNF05)', () => {
  const generous = { max: 100, timeWindowMs: MINUTE_MS };

  it('dado excesso de tentativas do mesmo IP, então responde 429 com Retry-After', async () => {
    await app.close();
    await startApp({ perIp: { max: 2, timeWindowMs: MINUTE_MS }, perAccount: generous });
    const attempt = () => post('/login', { email: 'x@exemplo.com', password: 'qualquer-senha' });

    expect((await attempt()).statusCode).toBe(401);
    expect((await attempt()).statusCode).toBe(401);
    const blocked = await attempt();

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(problemOf(blocked.body)).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('dado tentativas na mesma conta vindas de IPs diferentes, então bloqueia por conta', async () => {
    await app.close();
    await startApp({ perIp: generous, perAccount: { max: 2, timeWindowMs: MINUTE_MS } });
    const attempt = (remoteAddress: string, email = 'alvo@exemplo.com') =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: CSRF_HEADERS,
        remoteAddress,
        payload: { email, password: 'qualquer-senha' },
      });

    await attempt('10.0.0.1');
    await attempt('10.0.0.2');

    expect((await attempt('10.0.0.3', ' ALVO@exemplo.com')).statusCode).toBe(429);
    expect((await attempt('10.0.0.3', 'outra@exemplo.com')).statusCode).toBe(401);
  });

  it('dado excesso de cadastros do mesmo IP, então responde 429', async () => {
    await app.close();
    await startApp({ perIp: { max: 1, timeWindowMs: MINUTE_MS }, perAccount: generous });

    await post('/register', newRegistration());

    expect((await post('/register', newRegistration())).statusCode).toBe(429);
  });
});

describe('armazenamento da sessão (RNF02)', () => {
  it('grava o SHA-256 do ID da sessão, nunca o valor do cookie', async () => {
    const { cookie } = await registerUser(app);
    const token = cookie.slice(cookie.indexOf('=') + 1);

    const stored = await db.orm.select({ idHash: sessions.idHash }).from(sessions);

    expect(stored).toHaveLength(1);
    expect(stored[0]?.idHash).toEqual(createHash('sha256').update(token).digest());
    expect(stored[0]?.idHash.toString('utf8')).not.toContain(token);
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
  });
});
