import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetContacts } from './msw/contacts';
import { server } from './msw/server';

// O primeiro render de cada arquivo de teste (MSW + Suspense, sob cobertura) pode passar de 1 s
configure({ asyncUtilTimeout: 3000 });

// APIs de layout e ponteiro que o jsdom não implementa e que o Radix, o sonner e a rolagem do
// router usam (só com DOM: testes em ambiente node, como o de contraste dos tokens, não têm Element)
if ('Element' in globalThis) {
  Object.assign(Element.prototype, {
    scrollIntoView: () => undefined,
    hasPointerCapture: () => false,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  });
  Object.assign(window, { scrollTo: () => undefined });
}

// Requisição sem handler é erro: nenhum teste depende de rede real por acidente
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetContacts();
});

afterAll(() => {
  server.close();
});
