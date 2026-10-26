import { ImportStatus } from '@contatos/contracts';

/** Ciclo da importação (RN14, docs/04 §4.9); PROCESSING → PROCESSING é a retentativa do worker. */
const TRANSITIONS: Readonly<Record<ImportStatus, readonly ImportStatus[]>> = {
  PENDING: ['PROCESSING'],
  PROCESSING: ['PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'],
  COMPLETED: [],
  COMPLETED_WITH_ERRORS: [],
  FAILED: [],
};

export class InvalidImportTransition extends Error {
  constructor(
    readonly from: ImportStatus,
    readonly to: ImportStatus,
  ) {
    super(`Transição de importação inválida: ${from} → ${to}`);
    this.name = 'InvalidImportTransition';
  }
}

export function canTransition(from: ImportStatus, to: ImportStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transition(from: ImportStatus, to: ImportStatus): ImportStatus {
  if (!canTransition(from, to)) throw new InvalidImportTransition(from, to);
  return to;
}

export type ProcessingOutcome = { headerValid: false } | { headerValid: true; failedCount: number };

/** Status final (T-UB09): cabeçalho inválido → FAILED; sem erros → COMPLETED; senão, com erros. */
export function finalStatusOf(outcome: ProcessingOutcome): ImportStatus {
  if (!outcome.headerValid) return ImportStatus.FAILED;
  return outcome.failedCount === 0 ? ImportStatus.COMPLETED : ImportStatus.COMPLETED_WITH_ERRORS;
}
