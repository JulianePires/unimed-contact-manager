import '@testing-library/jest-dom/vitest';

import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetContacts } from './msw/contacts';
import { resetImports } from './msw/imports';
import { server } from './msw/server';

// O primeiro render de cada arquivo de teste (MSW + Suspense, sob cobertura) pode passar de 1 s
configure({ asyncUtilTimeout: 3000 });

const hasDom = 'Element' in globalThis;

// APIs de layout e ponteiro que o jsdom não implementa e que o Radix, o sonner e a rolagem do
// router usam (só com DOM: testes em ambiente node, como o de contraste dos tokens, não têm Element)
if (hasDom) {
  Object.assign(Element.prototype, {
    scrollIntoView: () => undefined,
    hasPointerCapture: () => false,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  });
  Object.assign(window, { scrollTo: () => undefined });
}

const MULTIPART_BOUNDARY = '----agenda-unimed-teste';

/** Serializa um FormData em multipart/form-data, preservando nome e tipo dos arquivos. */
async function toMultipart(form: FormData): Promise<Uint8Array<ArrayBuffer>> {
  const parts: Buffer[] = [];
  for (const [name, value] of form.entries()) {
    const disposition = `Content-Disposition: form-data; name="${name}"`;
    parts.push(
      typeof value === 'string'
        ? Buffer.from(`--${MULTIPART_BOUNDARY}\r\n${disposition}\r\n\r\n${value}\r\n`)
        : Buffer.concat([
            Buffer.from(
              `--${MULTIPART_BOUNDARY}\r\n${disposition}; filename="${value.name}"\r\nContent-Type: ${value.type}\r\n\r\n`,
            ),
            Buffer.from(await value.arrayBuffer()),
            Buffer.from('\r\n'),
          ]),
    );
  }
  parts.push(Buffer.from(`--${MULTIPART_BOUNDARY}--\r\n`));
  return new Uint8Array(Buffer.concat(parts));
}

/**
 * O fetch do Node não serializa o FormData do jsdom (upload da importação): o corpo vai como
 * bytes multipart, como o navegador enviaria.
 */
function withMultipartBodies(fetchImpl: typeof fetch): typeof fetch {
  return async (input, init) => {
    if (!(init?.body instanceof FormData)) return fetchImpl(input, init);
    const headers = new Headers(init.headers);
    headers.set('content-type', `multipart/form-data; boundary=${MULTIPART_BOUNDARY}`);
    return fetchImpl(input, { ...init, headers, body: await toMultipart(init.body) });
  };
}

// Requisição sem handler é erro: nenhum teste depende de rede real por acidente
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
  // Depois do listen, para envolver o fetch interceptado pelo MSW
  if (hasDom) globalThis.fetch = withMultipartBodies(globalThis.fetch);
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetContacts();
  resetImports();
});

afterAll(() => {
  server.close();
});
