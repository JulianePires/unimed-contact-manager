import { describe, expect, it, vi } from 'vitest';

import { ALLOWED_STATIC_HTML, installTrustedTypesPolicy } from './trusted-types';

describe('installTrustedTypesPolicy', () => {
  it('cria a política default, que só libera o HTML fixo conhecido', () => {
    const createPolicy = vi.fn();

    expect(installTrustedTypesPolicy({ trustedTypes: { createPolicy } })).toBe(true);

    expect(createPolicy).toHaveBeenCalledWith('default', expect.any(Object));
    const [, rules] = createPolicy.mock.calls[0] as [
      string,
      { createHTML: (input: string) => string | null },
    ];
    const [radixStyle = ''] = ALLOWED_STATIC_HTML;
    expect(rules.createHTML(radixStyle)).toBe(radixStyle);
    expect(rules.createHTML('<img src=x onerror=alert(1)>')).toBeNull();
    expect(rules.createHTML(`${radixStyle} `)).toBeNull();
  });

  it('sem suporte a Trusted Types no navegador, não faz nada', () => {
    expect(installTrustedTypesPolicy({})).toBe(false);
  });
});
