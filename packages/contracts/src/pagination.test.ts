import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { pageMeta, pageSchema } from './pagination';

describe('pageMeta', () => {
  it.each([
    [45, 20, 3],
    [40, 20, 2],
    [0, 20, 0],
    [1, 100, 1],
  ])('dado total %i e pageSize %i, então totalPages = %i', (total, pageSize, totalPages) => {
    expect(pageMeta({ page: 1, pageSize }, total)).toEqual({
      page: 1,
      pageSize,
      total,
      totalPages,
    });
  });
});

describe('pageSchema', () => {
  const schema = pageSchema(z.object({ id: z.string() }));

  it('valida o envelope { data, meta }', () => {
    const page = { data: [{ id: 'a' }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } };

    expect(schema.parse(page)).toEqual(page);
  });

  it('rejeita item fora do schema', () => {
    const page = { data: [{ id: 1 }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } };

    expect(schema.safeParse(page).success).toBe(false);
  });
});
