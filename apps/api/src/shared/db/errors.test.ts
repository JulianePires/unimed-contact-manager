import { describe, expect, it } from 'vitest';

import { isUniqueViolation } from './errors';

const violation = { code: '23505', constraint: 'users_email_uq' };

describe('isUniqueViolation', () => {
  it.each([
    ['erro do pg', violation],
    ['erro embrulhado pelo Drizzle', Object.assign(new Error('query'), { cause: violation })],
  ])('reconhece %s', (_, error) => {
    expect(isUniqueViolation(error, 'users_email_uq')).toBe(true);
  });

  it.each([
    ['outra constraint', violation, 'contacts_owner_mobile_uq'],
    ['outro código', { ...violation, code: '23514' }, 'users_email_uq'],
    ['valor que não é erro', 'boom', 'users_email_uq'],
    ['null', null, 'users_email_uq'],
  ])('ignora %s', (_, error, constraint) => {
    expect(isUniqueViolation(error, constraint)).toBe(false);
  });
});
