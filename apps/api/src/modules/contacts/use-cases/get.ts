import type { Contact } from '@contatos/contracts';
import { z } from 'zod';

import { contactEtag, toContact } from '../domain/contact';
import { contactNotFound } from '../domain/errors';
import type { ContactsRepository } from '../repository';

const contactIdSchema = z.uuid();

/** Contato do próprio usuário; id malformado, de outro usuário ou eliminado → 404 (RN06). */
export async function getContact(
  contacts: ContactsRepository,
  ownerId: string,
  id: string,
): Promise<{ contact: Contact; etag: string }> {
  const found = contactIdSchema.safeParse(id).success
    ? await contacts.findById(ownerId, id)
    : undefined;
  if (!found) throw contactNotFound();
  return { contact: toContact(found), etag: contactEtag(found.version) };
}
