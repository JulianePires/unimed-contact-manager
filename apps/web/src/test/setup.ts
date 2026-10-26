import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './msw/server';

// Rotas carregadas sob demanda: o primeiro acesso transforma o chunk e passa de 1 s com cobertura
configure({ asyncUtilTimeout: 3000 });

// APIs de layout e ponteiro que o jsdom não implementa e que o Radix e a restauração de rolagem do
// router usam (só com DOM: testes em ambiente node, como o de contraste dos tokens, não têm Element)
if ('Element' in globalThis) {
  Object.assign(Element.prototype, {
    scrollIntoView: () => undefined,
    hasPointerCapture: () => false,
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
});

afterAll(() => {
  server.close();
});
