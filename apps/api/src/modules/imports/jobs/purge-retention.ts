import type { Orm } from '@/shared/db/client';

import { createImportsRepository } from '../repository';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PurgeRetentionDeps {
  db: Orm;
  now: () => Date;
  retentionDays: number;
}

/**
 * Job agendado `purge-retention` (RN15, ADR-009 §3): descarta o conteúdo original (`raw`) das
 * linhas com erro de importações encerradas há mais de N dias. Linhas, códigos de erro e
 * contadores continuam disponíveis; a resposta passa a indicar `rawPurged`.
 */
export function purgeRetention({ db, now, retentionDays }: PurgeRetentionDeps): Promise<number> {
  const cutoff = new Date(now().getTime() - retentionDays * DAY_MS);
  return createImportsRepository(db).purgeErrorRawBefore(cutoff);
}
