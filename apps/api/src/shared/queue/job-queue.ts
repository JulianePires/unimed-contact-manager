import type { Transaction } from '@/shared/db/transaction';

/** Jobs da aplicação e seus dados; o nome é o da fila no pg-boss (ADR-003). */
export interface JobPayloads {
  'process-import': { importId: string };
}

export type JobName = keyof JobPayloads;

export const JOB_NAMES: readonly JobName[] = ['process-import'];

/**
 * Porta da fila (ADR-007: porta/adaptador só onde há variação real). O job é gravado pela mesma
 * transação dos dados: só existe se ela confirmar, sem dual write (ADR-003).
 */
export interface JobQueue {
  enqueue<N extends JobName>(tx: Transaction, name: N, payload: JobPayloads[N]): Promise<void>;
}
