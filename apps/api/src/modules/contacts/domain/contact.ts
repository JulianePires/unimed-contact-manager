import { type Contact, formatPhone } from '@contatos/contracts';
import { z } from 'zod';

import { formatOptionalPhone, phoneDigitsOf } from './phone';
import { contactStatusOf } from './status';

/** Contato como persistido; `email`/`mobileE164` só são nulos após a anonimização (ADR-009). */
export interface ContactRecord {
  id: string;
  name: string;
  email: string | null;
  mobileE164: string | null;
  phoneE164: string | null;
  isFavorite: boolean;
  deactivatedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export function toContact(record: ContactRecord): Contact {
  if (record.email === null || record.mobileE164 === null) {
    throw new Error('Contato eliminado não tem representação pública');
  }
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    mobile: record.mobileE164,
    mobileFormatted: formatPhone(record.mobileE164),
    phone: record.phoneE164,
    phoneFormatted: formatOptionalPhone(record.phoneE164),
    isFavorite: record.isFavorite,
    status: contactStatusOf(record.deactivatedAt),
    deactivatedAt: record.deactivatedAt?.toISOString() ?? null,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

const contactIdSchema = z.uuid();

/** Id malformado nunca identifica um contato: responde 404 sem consultar o banco. */
export function isContactId(id: string): boolean {
  return contactIdSchema.safeParse(id).success;
}

/** `ETag` derivado da versão (docs/05 §5.1): `"v3"`. */
export function contactEtag(version: number): string {
  return `"v${version}"`;
}

const IF_MATCH = /^"v([1-9]\d{0,9})"$/;

/**
 * Versão esperada pelo cliente no `If-Match` (`"v3"` → 3); ausente → `undefined`. Valor que não
 * é um ETag nosso nunca casa com a versão atual: vira 0, que produz 412.
 */
export function expectedVersionOf(ifMatch: string | undefined): number | undefined {
  if (ifMatch === undefined) return undefined;
  const match = IF_MATCH.exec(ifMatch.trim());
  return match ? Number(match[1]) : 0;
}

/** Marcador que substitui o nome na eliminação (ADR-009). */
export const ANONYMIZED_NAME = 'Contato removido';

export type SearchIntent =
  | { kind: 'mobile'; digits: string }
  | { kind: 'email'; term: string }
  | { kind: 'name-or-email'; term: string };

const MIN_SEARCH_LENGTH = 2;

/**
 * Intenção da busca (ADR-005): só dígitos após remover a máscara → celular; com `@` → e-mail;
 * demais → nome ou e-mail. Termos com menos de 2 caracteres não buscam.
 */
export function parseSearchIntent(term: string | undefined): SearchIntent | undefined {
  const trimmed = term?.trim() ?? '';
  const digits = phoneDigitsOf(trimmed);
  if (digits !== undefined) {
    return digits.length < MIN_SEARCH_LENGTH ? undefined : { kind: 'mobile', digits };
  }
  if (trimmed.length < MIN_SEARCH_LENGTH) return undefined;
  return trimmed.includes('@')
    ? { kind: 'email', term: trimmed }
    : { kind: 'name-or-email', term: trimmed };
}
