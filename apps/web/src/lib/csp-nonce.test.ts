import { getNonce } from 'get-nonce';
import { afterEach, describe, expect, it } from 'vitest';

import { applyCspNonce } from './csp-nonce';

function setMeta(content: string | undefined) {
  document.head.querySelector('meta[name="csp-nonce"]')?.remove();
  if (content === undefined) return;
  const meta = document.createElement('meta');
  meta.name = 'csp-nonce';
  meta.content = content;
  document.head.append(meta);
}

afterEach(() => {
  setMeta(undefined);
});

describe('applyCspNonce', () => {
  it('registra o nonce entregue pela API para os estilos do Radix', () => {
    setMeta('a1b2c3d4e5f60718293a4b5c6d7e8f90');

    expect(applyCspNonce()).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90');
    expect(getNonce()).toBe('a1b2c3d4e5f60718293a4b5c6d7e8f90');
  });

  it.each([
    ['marcador não substituído (servidor do Vite)', '__CSP_NONCE__'],
    ['meta vazia', ''],
    ['sem meta', undefined],
  ])('não registra nada com %s', (_, content) => {
    setMeta(content);

    expect(applyCspNonce()).toBeUndefined();
  });
});
