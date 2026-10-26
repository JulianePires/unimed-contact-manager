import type { Transaction } from '@/shared/db/transaction';

/** Jobs da aplicação e seus dados; o nome é o da fila no pg-boss (ADR-003). */
export interface JobPayloads {
  'process-import': { importId: string };
  'purge-retention': Record<string, never>;
}

export type JobName = keyof JobPayloads;

export const JOB_NAMES: readonly JobName[] = ['process-import', 'purge-retention'];

/**
 * Porta da fila (ADR-007: porta/adaptador só onde há variação real). O job é gravado pela mesma
 * transação dos dados: só existe se ela confirmar, sem dual write (ADR-003).
 */
export interface JobQueue {
  enqueue<N extends JobName>(tx: Transaction, name: N, payload: JobPayloads[N]): Promise<void>;
}

/**
 * Consumo: um handler por job. O `signal` é abortado no desligamento; handlers longos o consultam
 * entre etapas seguras (o processamento da importação, entre lotes).
 */
export type JobHandlers = {
  [N in JobName]: (payload: JobPayloads[N], signal: AbortSignal) => Promise<unknown>;
};

/** Jobs recorrentes (cron em UTC): expurgo de retenção diário às 06:00 UTC (03:00 em Brasília). */
export const JOB_SCHEDULES: readonly { name: JobName; cron: string }[] = [
  { name: 'purge-retention', cron: '0 6 * * *' },
];
