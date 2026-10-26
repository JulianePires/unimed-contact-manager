import type { Contact, CreateContactData } from '@contatos/contracts';

import { contactEtag, toContact } from '../domain/contact';
import { mobileConflict } from '../domain/errors';
import type { ContactsRepository } from '../repository';

/** Cadastro (RF05, RN01–RN05): normalizado pelo schema, unicidade garantida pelo banco. */
export async function createContact(
  contacts: ContactsRepository,
  ownerId: string,
  input: CreateContactData,
): Promise<{ contact: Contact; etag: string }> {
  const result = await contacts.insert({
    ownerId,
    name: input.name,
    email: input.email,
    mobileE164: input.mobile,
    phoneE164: input.phone,
  });
  if (result.outcome === 'mobile-conflict') throw mobileConflict(result.conflictingContact);
  return { contact: toContact(result.contact), etag: contactEtag(result.contact.version) };
}
