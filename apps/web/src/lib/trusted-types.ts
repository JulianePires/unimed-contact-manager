/**
 * HTML que dependências escrevem com `innerHTML`, conhecido e fixo: o `<style>` do viewport do
 * Radix Select. Qualquer outro texto continua bloqueado pelos Trusted Types (ADR-008).
 */
export const ALLOWED_STATIC_HTML: ReadonlySet<string> = new Set([
  '[data-radix-select-viewport]{scrollbar-width:none;-ms-overflow-style:none;-webkit-overflow-scrolling:touch;}[data-radix-select-viewport]::-webkit-scrollbar{display:none}',
]);

interface TrustedTypesFactory {
  createPolicy(name: string, rules: { createHTML: (input: string) => string | null }): unknown;
}

/**
 * Política "default" dos Trusted Types: libera só o HTML fixo da lista acima; o resto devolve
 * `null`, e o navegador bloqueia a escrita. Sem suporte a Trusted Types, não faz nada.
 */
export function installTrustedTypesPolicy(
  target: { trustedTypes?: TrustedTypesFactory } = window as { trustedTypes?: TrustedTypesFactory },
): boolean {
  if (!target.trustedTypes) return false;
  target.trustedTypes.createPolicy('default', {
    createHTML: (input) => (ALLOWED_STATIC_HTML.has(input) ? input : null),
  });
  return true;
}
