import type { FieldError } from '@contatos/contracts';

import { CSV_COLUMNS } from './csv-sniffer';

/**
 * Celular repetido no mesmo arquivo (RN12): a primeira ocorrência segue; a partir da segunda, a
 * linha vira `DUPLICATE_IN_FILE` com a linha original. Compara o E.164, então máscaras diferentes
 * do mesmo número também são duplicatas.
 */
export function createDuplicateTracker() {
  const firstLineByMobile = new Map<string, number>();
  return {
    check(mobileE164: string, lineNumber: number): FieldError | undefined {
      const firstLine = firstLineByMobile.get(mobileE164);
      if (firstLine === undefined) {
        firstLineByMobile.set(mobileE164, lineNumber);
        return undefined;
      }
      return {
        field: CSV_COLUMNS.mobile,
        code: 'DUPLICATE_IN_FILE',
        message: `Celular repetido no arquivo; primeira ocorrência na linha ${firstLine}.`,
        firstLine,
      };
    },
  };
}

export type DuplicateTracker = ReturnType<typeof createDuplicateTracker>;
