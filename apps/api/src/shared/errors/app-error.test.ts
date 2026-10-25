import { describe, expect, it } from 'vitest';

import { AppError } from './app-error';

describe('AppError', () => {
  it.each([400, 404, 503, 599])('aceita status de erro %i', (status) => {
    expect(new AppError(status, 'NOT_FOUND', 'x').status).toBe(status);
  });

  it.each([200, 302, 399, 600, 404.5, Number.NaN])('rejeita status %d', (status) => {
    expect(() => new AppError(status, 'NOT_FOUND', 'x')).toThrow(RangeError);
  });
});
