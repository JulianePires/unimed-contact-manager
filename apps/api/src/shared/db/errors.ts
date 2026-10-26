const UNIQUE_VIOLATION = '23505';

interface PgError {
  code?: unknown;
  constraint?: unknown;
}

function pgErrorOf(error: unknown): PgError | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  if ('cause' in error && typeof error.cause === 'object' && error.cause !== null) {
    return error.cause;
  }
  return error;
}

/** Violação de UNIQUE (`23505`) na constraint indicada, inclusive embrulhada pelo Drizzle. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  const pgError = pgErrorOf(error);
  return pgError?.code === UNIQUE_VIOLATION && pgError.constraint === constraint;
}
