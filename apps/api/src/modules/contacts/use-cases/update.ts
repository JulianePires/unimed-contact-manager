import type { Contact, UpdateContactData } from '@contatos/contracts';

import { contactEtag, expectedVersionOf, isContactId, toContact } from '../domain/contact';
import {
  contactNotFound,
  mobileConflict,
  preconditionRequired,
  rejectedUpdate,
} from '../domain/errors';
import type { ContactsRepository } from '../repository';

/**
 * Edição dos dados (RF10, RN07): exige `If-Match` com a versão lida; o UPDATE só se aplica se a
 * versão não mudou e a incrementa. Celular novo segue a mesma unicidade do cadastro (ADR-001).
 */
export async function updateContact(
  contacts: ContactsRepository,
  ownerId: string,
  id: string,
  ifMatch: string | undefined,
  input: UpdateContactData,
): Promise<{ contact: Contact; etag: string }> {
  if (!isContactId(id)) throw contactNotFound();
  const expectedVersion = expectedVersionOf(ifMatch);
  if (expectedVersion === undefined) throw preconditionRequired();

  const result = await contacts.update(ownerId, id, expectedVersion, {
    name: input.name,
    email: input.email,
    mobileE164: input.mobile,
    phoneE164: input.phone,
  });
  switch (result.outcome) {
    case 'written':
      return { contact: toContact(result.contact), etag: contactEtag(result.contact.version) };
    case 'mobile-conflict':
      throw mobileConflict(result.conflictingContact);
    case 'not-matched':
      throw rejectedUpdate(await contacts.findById(ownerId, id));
  }
}
