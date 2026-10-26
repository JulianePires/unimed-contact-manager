import { AsYouType, type PhoneNumberType, parsePhoneNumberFromString } from 'libphonenumber-js/max';

/** Região assumida quando o número vem sem código do país (ADR-001). */
export const DEFAULT_PHONE_REGION = 'BR';

export type PhoneKind = 'mobile' | 'fixed' | 'fixed-or-mobile' | 'other';

export interface NormalizedPhone {
  e164: string;
  kind: PhoneKind;
}

export type MobileNormalization =
  | { ok: true; e164: string }
  | { ok: false; code: 'INVALID_PHONE' | 'NOT_A_MOBILE_NUMBER' };

function kindOf(type: PhoneNumberType | undefined): PhoneKind {
  switch (type) {
    case 'MOBILE':
      return 'mobile';
    case 'FIXED_LINE':
      return 'fixed';
    case 'FIXED_LINE_OR_MOBILE':
      return 'fixed-or-mobile';
    default:
      return 'other';
  }
}

/** Normaliza para E.164 qualquer formato de entrada (máscara, espaços, `+55`, prefixo 0). */
export function normalizePhone(input: string): NormalizedPhone | null {
  const parsed = parsePhoneNumberFromString(input, DEFAULT_PHONE_REGION);
  if (!parsed?.isValid()) return null;
  return { e164: parsed.number, kind: kindOf(parsed.getType()) };
}

/** Celular: número válido classificado como móvel (números estrangeiros ambíguos são aceitos). */
export function normalizeMobile(input: string): MobileNormalization {
  const phone = normalizePhone(input);
  if (!phone) return { ok: false, code: 'INVALID_PHONE' };
  if (phone.kind !== 'mobile' && phone.kind !== 'fixed-or-mobile') {
    return { ok: false, code: 'NOT_A_MOBILE_NUMBER' };
  }
  return { ok: true, e164: phone.e164 };
}

/** Formato de exibição: nacional para números do Brasil, internacional para os demais. */
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === DEFAULT_PHONE_REGION
    ? parsed.formatNational()
    : parsed.formatInternational();
}

/** Valor bruto de um campo de telefone: só os dígitos, com o `+` inicial se a pessoa digitou. */
export function phoneInputDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  return value.trimStart().startsWith('+') ? `+${digits}` : digits;
}

/** Máscara de exibição enquanto se digita (`81999990000` → `(81) 99999-0000`). */
export function formatPhoneInput(raw: string): string {
  return raw ? new AsYouType(DEFAULT_PHONE_REGION).input(raw) : '';
}

/** Valor inicial do campo ao editar: número nacional para o Brasil, E.164 para os demais. */
export function phoneInputValue(e164: string | null): string {
  if (!e164) return '';
  const parsed = parsePhoneNumberFromString(e164);
  return parsed?.country === DEFAULT_PHONE_REGION ? parsed.nationalNumber : e164;
}
