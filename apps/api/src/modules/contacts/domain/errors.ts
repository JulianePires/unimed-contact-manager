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

/** PATCH sem `If-Match` (ADR-004): edições exigem a versão lida. */
export function preconditionRequired(): AppError {
  return new AppError(428, 'PRECONDITION_REQUIRED', 'Informe a versão do contato (If-Match)');
}

/**
 * Edição condicional sem efeito (`WHERE version = $v` não casou): sumiu ou foi eliminado → 404;
 * versão diferente → 412 `CONTACT_MODIFIED`, sem sobrescrever a alteração mais recente (RN07).
 */
export function rejectedUpdate(current: object | undefined): AppError {
  if (!current) return contactNotFound();
  return new AppError(412, 'CONTACT_MODIFIED', 'Contato alterado em outra sessão');
}

/** Eliminação sem efeito: inexistente ou já eliminado → 404; ainda ativo → 409 (RN09). */
export function rejectedAnonymization(current: ConflictingContact | undefined): AppError {
  if (!current) return contactNotFound();
  return new AppError(
    409,
    'CONTACT_MUST_BE_INACTIVE',
    'Inative o contato antes de eliminar os dados',
    { contactId: current.id },
  );
}
