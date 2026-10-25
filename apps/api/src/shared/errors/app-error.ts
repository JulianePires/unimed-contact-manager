import type { ErrorCode } from '@contatos/contracts';

/** Erro esperado da aplicação, convertido em Problem Details pelo handler central. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly title: string,
    readonly extras: Record<string, unknown> = {},
  ) {
    super(title);
    this.name = 'AppError';
  }
}
