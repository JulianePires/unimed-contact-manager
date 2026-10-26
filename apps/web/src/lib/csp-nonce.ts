import { setNonce } from 'get-nonce';

/** Marcador do `index.html` que a API troca pelo nonce de estilo de cada resposta. */
const PLACEHOLDER = '__CSP_NONCE__';

/**
 * Registra o nonce de estilo da CSP (ADR-008) para os `<style>` que o Radix injeta em tempo de
 * execução. No servidor do Vite não há CSP e o marcador fica intacto: nada a registrar.
 */
export function applyCspNonce(doc: Document = document): string | undefined {
  const nonce = doc.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content;
  if (!nonce || nonce === PLACEHOLDER) return undefined;
  setNonce(nonce);
  return nonce;
}
