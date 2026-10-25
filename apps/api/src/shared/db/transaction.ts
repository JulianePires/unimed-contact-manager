import type { Orm } from './client';

export type Transaction = Parameters<Parameters<Orm['transaction']>[0]>[0];
export type Executor = Orm | Transaction;

/** Executa `work` numa transação; chamado dentro de outra, abre um savepoint. */
export function withTransaction<T>(
  executor: Executor,
  work: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return executor.transaction(work);
}
