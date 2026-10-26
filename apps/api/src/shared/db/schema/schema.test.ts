import { getTableName } from 'drizzle-orm';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import { contacts, importErrors, importFiles, imports, sessions } from './index';

function foreignKeysOf(table: PgTable) {
  return getTableConfig(table).foreignKeys.map((foreignKey) => {
    const reference = foreignKey.reference();
    return {
      columns: reference.columns.map((column) => column.name),
      references: getTableName(reference.foreignTable),
      onDelete: foreignKey.onDelete,
    };
  });
}

describe('chaves estrangeiras (docs/03 §3.5)', () => {
  it.each([
    ['contacts', contacts, ['owner_id'], 'users', 'no action'],
    ['imports', imports, ['owner_id'], 'users', 'no action'],
    ['sessions', sessions, ['user_id'], 'users', 'cascade'],
    ['import_files', importFiles, ['import_id'], 'imports', 'cascade'],
    ['import_errors', importErrors, ['import_id'], 'imports', 'cascade'],
  ] as const)('%s.%s → %s (on delete %s)', (_, table, columns, references, onDelete) => {
    expect(foreignKeysOf(table)).toEqual([{ columns, references, onDelete }]);
  });
});
