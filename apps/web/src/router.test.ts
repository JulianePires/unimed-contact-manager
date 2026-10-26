import { createMemoryHistory } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { createQueryClient } from './lib/query-client';
import { createAppRouter } from './router';

describe('createAppRouter', () => {
  it('sem histórico injetado, usa o histórico do navegador', () => {
    window.history.replaceState(null, '', '/rota-do-navegador');

    const router = createAppRouter({ queryClient: createQueryClient() });

    expect(router.history.location.pathname).toBe('/rota-do-navegador');
  });

  it('com histórico em memória, parte da entrada inicial e expõe o queryClient no contexto', () => {
    const queryClient = createQueryClient();

    const router = createAppRouter({
      queryClient,
      history: createMemoryHistory({ initialEntries: ['/inicio'] }),
    });

    expect(router.history.location.pathname).toBe('/inicio');
    expect(router.options.context).toEqual({ queryClient });
  });
});
