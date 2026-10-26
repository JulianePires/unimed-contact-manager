import { describe, expect, it } from 'vitest';

import { ERROR_CODES, ERROR_STATUS, ErrorCode, errorCodeSchema } from './error-codes';

/** Tabela de docs/05 §5.2. */
const DOCUMENTED: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  CSRF_HEADER_MISSING: 403,
  NOT_FOUND: 404,
  MOBILE_ALREADY_EXISTS: 409,
  MOBILE_BELONGS_TO_INACTIVE_CONTACT: 409,
  CONTACT_MUST_BE_INACTIVE: 409,
  CONTACT_ANONYMIZED: 409,
  IMPORT_ALREADY_EXISTS: 409,
  REGISTRATION_FAILED: 409,
  CONTACT_MODIFIED: 412,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_FILE_TYPE: 415,
  VALIDATION_ERROR: 422,
  PRECONDITION_REQUIRED: 428,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

describe('códigos de erro (docs/05 §5.2)', () => {
  it('mapeia todos os códigos documentados para o status HTTP da tabela', () => {
    expect(ERROR_STATUS).toEqual(DOCUMENTED);
  });

  it('cada código tem a si mesmo como valor', () => {
    for (const [key, value] of Object.entries(ErrorCode)) expect(value).toBe(key);
  });

  it('ERROR_CODES e o schema aceitam exatamente os códigos documentados', () => {
    expect([...ERROR_CODES].sort()).toEqual(Object.keys(DOCUMENTED).sort());
    expect(errorCodeSchema.options).toEqual(ERROR_CODES);
  });

  it.each(Object.entries(ERROR_STATUS))('%s usa status de erro (%i)', (_, status) => {
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(600);
  });
});
