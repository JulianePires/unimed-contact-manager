import { ImportStatus } from '@contatos/contracts';
import { describe, expect, it } from 'vitest';

import { canTransition, finalStatusOf, InvalidImportTransition, transition } from './import-status';

const VALID: readonly [ImportStatus, ImportStatus][] = [
  ['PENDING', 'PROCESSING'],
  ['PROCESSING', 'PROCESSING'],
  ['PROCESSING', 'COMPLETED'],
  ['PROCESSING', 'COMPLETED_WITH_ERRORS'],
  ['PROCESSING', 'FAILED'],
];

const isValid = (from: ImportStatus, to: ImportStatus) =>
  VALID.some(([validFrom, validTo]) => validFrom === from && validTo === to);

const STATUSES = Object.values(ImportStatus);
const ALL_PAIRS = STATUSES.flatMap((from) => STATUSES.map((to) => [from, to] as const));

describe('máquina de estados da importação (RN14)', () => {
  it.each(ALL_PAIRS)('%s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(isValid(from, to));
  });

  it('transição válida devolve o novo status', () => {
    expect(transition('PENDING', 'PROCESSING')).toBe('PROCESSING');
  });

  it.each([
    ['PENDING', 'COMPLETED'],
    ['COMPLETED', 'PROCESSING'],
    ['FAILED', 'PENDING'],
  ] as const)('transição inválida %s → %s falha com a origem e o destino', (from, to) => {
    expect(() => transition(from, to)).toThrow(InvalidImportTransition);
    expect(() => transition(from, to)).toThrow(`${from} → ${to}`);
  });
});

describe('finalStatusOf (T-UB09)', () => {
  it.each([
    [{ headerValid: true, failedCount: 0 } as const, 'COMPLETED'],
    [{ headerValid: true, failedCount: 3 } as const, 'COMPLETED_WITH_ERRORS'],
    [{ headerValid: false } as const, 'FAILED'],
  ])('%o → %s', (outcome, status) => {
    expect(finalStatusOf(outcome)).toBe(status);
  });
});
