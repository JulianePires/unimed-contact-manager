import { randomUUID } from 'node:crypto';

import { AxeBuilder } from '@axe-core/playwright';
import { type APIRequestContext, test as base, expect, type Page } from '@playwright/test';

export { expect };

const CSRF = { 'X-Requested-With': 'fetch' };

export interface E2EUser {
  name: string;
  email: string;
  password: string;
}

/** Usuário novo por teste: cada cenário começa com a agenda vazia e não depende dos outros. */
export function newUser(name = 'Pessoa E2E'): E2EUser {
  const id = randomUUID();
  return { name, email: `e2e-${id}@exemplo.com`, password: `e2e-${id}` };
}

/**
 * Cadastro pela API (login por API): o cookie de sessão fica no contexto do navegador. Confere a
 * sessão em `/auth/me`, para uma falha aparecer aqui e não como "tela de login" mais adiante.
 */
export async function registerByApi(request: APIRequestContext, user: E2EUser): Promise<void> {
  const response = await request.post('/api/v1/auth/register', { headers: CSRF, data: user });
  if (response.status() === 429) {
    throw new Error(
      'Cadastro recusado pelo limite por IP (429): suba a stack com `pnpm e2e:up` (docker-compose.e2e.yml).',
    );
  }
  expect(response.status(), await response.text()).toBe(201);
  const me = await request.get('/api/v1/auth/me');
  expect(me.status(), 'sessão não ficou no contexto do navegador').toBe(200);
}

export interface ContactInput {
  name: string;
  email: string;
  mobile: string;
}

export async function createContactByApi(
  request: APIRequestContext,
  contact: ContactInput,
): Promise<{ id: string }> {
  const response = await request.post('/api/v1/contacts', { headers: CSRF, data: contact });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as { id: string };
}

/** WCAG 2.2 AA: nenhuma violação séria ou crítica na tela atual (docs/09 §9.5). */
export async function expectAccessible(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every(({ playState }) => playState !== 'running'),
  );
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const blocking = violations
    .filter(({ impact }) => impact === 'serious' || impact === 'critical')
    .map(
      ({ id, help, nodes }) =>
        `${id}: ${help} (${nodes.map((node) => node.target.join(' ')).join(', ')})`,
    );
  expect(blocking, `violações axe em ${page.url()}`).toEqual([]);
}

interface Fixtures {
  /** Página já autenticada com um usuário novo, cadastrado pela API. */
  signedIn: Page;
}

export const test = base.extend<Fixtures>({
  signedIn: async ({ page }, provide) => {
    await registerByApi(page.request, newUser());
    await provide(page);
  },
});
