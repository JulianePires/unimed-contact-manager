import { isContactId } from '../domain/contact';
import { contactNotFound, rejectedAnonymization } from '../domain/errors';
import type { ContactsRepository } from '../repository';

/**
 * Eliminação dos dados pessoais (RF14, RN09, ADR-009): só de contato inativo. A condição está no
 * próprio UPDATE; sem efeito, o estado atual define a resposta (404 ou 409).
 */
export async function anonymizeContact(
  contacts: ContactsRepository,
  ownerId: string,
  id: string,
): Promise<void> {
  if (!isContactId(id)) throw contactNotFound();
  if (await contacts.anonymize(ownerId, id)) return;
  throw rejectedAnonymization(await contacts.findById(ownerId, id));
}
