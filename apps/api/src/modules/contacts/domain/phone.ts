import { formatPhone } from '@contatos/contracts';

const PHONE_MASK = /[\s().+-]/g;
const ONLY_DIGITS = /^\d+$/;

/** Remove a máscara de digitação: `(81) 99876-5432` → `81998765432`. */
export function stripPhoneMask(value: string): string {
  return value.replace(PHONE_MASK, '');
}

/** Termo que, sem a máscara, só tem dígitos: o usuário está procurando por número (ADR-005). */
export function phoneDigitsOf(term: string): string | undefined {
  const digits = stripPhoneMask(term);
  return ONLY_DIGITS.test(digits) ? digits : undefined;
}

/** E.164 → formato de exibição (`…Formatted`, docs/05 §5.1). */
export function formatOptionalPhone(e164: string | null): string | null {
  return e164 === null ? null : formatPhone(e164);
}
