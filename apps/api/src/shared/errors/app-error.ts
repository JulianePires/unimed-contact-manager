import type { ErrorCode } from '@contatos/contracts';

/** Erro esperado da aplicação, convertido em Problem Details pelo handler central. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly title: string,
    readonly extras: Record<string, unknown> = {},
  ) {
    // Problem Details só admite status de erro (contrato: inteiro 400–599)
    if (!Number.isInteger(status) || status < 400 || status > 599) {
      throw new RangeError(`Status HTTP de erro inválido: ${status}`);
    }
    super(title);
    this.name = 'AppError';
  }
}
