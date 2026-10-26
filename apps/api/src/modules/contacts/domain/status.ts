import type { ContactStatus } from '@contatos/contracts';

/** `deactivated_at` nulo é ativo; preenchido é inativo desde aquele momento (ADR-004). */
export function contactStatusOf(deactivatedAt: Date | null): ContactStatus {
  return deactivatedAt === null ? 'active' : 'inactive';
}
