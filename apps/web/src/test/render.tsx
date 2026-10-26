import { createMemoryHistory } from '@tanstack/react-router';
import { render } from '@testing-library/react';
import { StrictMode } from 'react';

import { App } from '../app';
import { createQueryClient } from '../lib/query-client';
import { createAppRouter } from '../router';

/** Renderiza o app como em main.tsx (StrictMode + providers + roteador), com histórico em memória. */
export function renderRoute(path: string) {
  const queryClient = createQueryClient();
  const router = createAppRouter({
    queryClient,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return {
    router,
    ...render(<App queryClient={queryClient} router={router} />, { wrapper: StrictMode }),
  };
}
