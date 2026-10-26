import type { ContactsRepository } from '../repository';
import { transitionStatus } from './status-transition';

/** Reativar (RF12); contato eliminado não volta (RN09). */
export function reactivateContact(contacts: ContactsRepository, ownerId: string, id: string) {
  return transitionStatus(contacts, ownerId, id, false);
}
