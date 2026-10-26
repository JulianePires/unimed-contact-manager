import type { ContactsRepository } from '../repository';
import { transitionStatus } from './status-transition';

/** Inativar (RF11): o celular continua reservado pelo contato (ADR-001). */
export function deactivateContact(contacts: ContactsRepository, ownerId: string, id: string) {
  return transitionStatus(contacts, ownerId, id, true);
}
