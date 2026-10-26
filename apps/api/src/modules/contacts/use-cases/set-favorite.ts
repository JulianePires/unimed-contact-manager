import { isContactId } from '../domain/contact';
import { contactNotFound } from '../domain/errors';
import type { ContactsRepository } from '../repository';

/** Favoritar/desfavoritar (RF13): o favorito é um recurso, e a operação é idempotente (RN08). */
export async function setFavorite(
  contacts: ContactsRepository,
  ownerId: string,
  id: string,
  isFavorite: boolean,
): Promise<void> {
  const found = isContactId(id) && (await contacts.setFavorite(ownerId, id, isFavorite));
  if (!found) throw contactNotFound();
}
