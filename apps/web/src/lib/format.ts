import { formatPhone } from '@contatos/contracts';

const LOCALE = 'pt-BR';

/** E.164 → exibição (`(81) 99999-0000`), com a mesma regra da API; vazio vira "—". */
export function formatPhoneForDisplay(e164: string | null | undefined): string {
  return e164 ? formatPhone(e164) : '—';
}

/** Data ISO 8601 (UTC, docs/05 §5.1) no fuso de quem lê: `26/10/2026`. */
export function formatDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'short', timeZone }).format(new Date(iso));
}

/** `26/10/2026, 09:30`. */
export function formatDateTime(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(iso));
}

/** Contagens com separador de milhar: `1.200`. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

/** Plural simples em português: `1 contato`, `23 contatos`. */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}
