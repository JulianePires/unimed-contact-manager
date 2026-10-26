import type { CreateContactData } from '@contatos/contracts';

import type { ContactsRepository } from '../repository';

export interface ImportedBatch {
  created: number;
  skipped: number;
}

/**
 * Lote vindo da importação de CSV (RN11): cria os contatos novos e ignora os celulares que já
 * existem na agenda, sem alterá-los. Os dados já chegam validados e normalizados.
 */
export async function importContactsBatch(
  contacts: ContactsRepository,
  ownerId: string,
  batch: readonly CreateContactData[],
): Promise<ImportedBatch> {
  const created = await contacts.insertIgnoringExisting(
    batch.map((contact) => ({
      ownerId,
      name: contact.name,
      email: contact.email,
      mobileE164: contact.mobile,
      phoneE164: contact.phone,
    })),
  );
  return { created, skipped: batch.length - created };
}
