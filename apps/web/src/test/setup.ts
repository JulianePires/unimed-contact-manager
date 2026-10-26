import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// APIs de layout e ponteiro que o jsdom não implementa e os primitivos do Radix usam (só com DOM:
// testes em ambiente node, como o de contraste dos tokens, não têm Element)
if ('Element' in globalThis) {
  Object.assign(Element.prototype, {
    scrollIntoView: () => undefined,
    hasPointerCapture: () => false,
    releasePointerCapture: () => undefined,
  });
}

afterEach(() => {
  cleanup();
});
