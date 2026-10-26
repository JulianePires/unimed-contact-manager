import type { Contact } from '@contatos/contracts';

import { contactEtag, isContactId, toContact } from '../domain/contact';
import { contactNotFound } from '../domain/errors';
import type { ContactsRepository } from '../repository';

/**
 * Inativar/reativar (RN08) são idempotentes: se o contato já está no estado pedido, nada muda e a
 * resposta é o estado atual. Eliminado ou de outro usuário → 404.
 */
export async function transitionStatus(
  contacts: ContactsRepository,
  ownerId: string,
  id: string,
  deactivated: boolean,
): Promise<{ contact: Contact; etag: string }> {
  if (!isContactId(id)) throw contactNotFound();
  const current =
    (await contacts.setDeactivated(ownerId, id, deactivated)) ??
    (await contacts.findById(ownerId, id));
  if (!current) throw contactNotFound();
  return { contact: toContact(current), etag: contactEtag(current.version) };
}
