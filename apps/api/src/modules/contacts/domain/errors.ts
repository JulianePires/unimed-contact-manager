import { AppError } from '@/shared/errors';

import { contactStatusOf } from './status';

export interface ConflictingContact {
  id: string;
  deactivatedAt: Date | null;
}

/**
 * Celular já usado na agenda (ADR-001): ativo → `MOBILE_ALREADY_EXISTS`; inativo →
 * `MOBILE_BELONGS_TO_INACTIVE_CONTACT`, com o `contactId` para a UI oferecer a reativação.
 * Sem o conflitante (eliminado entre o INSERT e a consulta), o celular segue em uso: 409 sem id.
 */
export function mobileConflict(existing: ConflictingContact | undefined): AppError {
  if (existing && contactStatusOf(existing.deactivatedAt) === 'inactive') {
    return new AppError(
      409,
      'MOBILE_BELONGS_TO_INACTIVE_CONTACT',
      'Celular pertence a um contato inativo',
      { contactId: existing.id },
    );
  }
  return new AppError(
    409,
    'MOBILE_ALREADY_EXISTS',
    'Celular já cadastrado',
    existing ? { contactId: existing.id } : {},
  );
}

/** Inexistente, de outro usuário ou eliminado: sempre 404, sem revelar qual (ADR-004). */
export function contactNotFound(): AppError {
  return new AppError(404, 'NOT_FOUND', 'Contato não encontrado');
}
