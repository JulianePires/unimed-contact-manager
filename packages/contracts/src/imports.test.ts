import { describe, expect, it } from 'vitest';

import {
  ImportStatus,
  importErrorSchema,
  importSchema,
  isTerminalImportStatus,
  listImportErrorsQuerySchema,
  listImportsQuerySchema,
} from './imports';

describe('ImportStatus (RN14)', () => {
  it('tem exatamente os status do ciclo da importação', () => {
    expect(Object.values(ImportStatus)).toEqual([
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'COMPLETED_WITH_ERRORS',
      'FAILED',
    ]);
  });

  it.each([
    ['PENDING', false],
    ['PROCESSING', false],
    ['COMPLETED', true],
    ['COMPLETED_WITH_ERRORS', true],
    ['FAILED', true],
  ] as const)('%s é terminal: %s', (status, terminal) => {
    expect(isTerminalImportStatus(status)).toBe(terminal);
  });
});

describe('importSchema', () => {
  it('aceita uma importação em andamento', () => {
    const value = {
      id: '0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e',
      fileName: 'clientes-outubro.csv',
      status: 'PROCESSING',
      totalRows: 1200,
      processedRows: 400,
      createdCount: 390,
      skippedCount: 6,
      failedCount: 4,
      failureReason: null,
      createdAt: '2026-10-24T14:03:00.000Z',
      startedAt: '2026-10-24T14:03:01.000Z',
      finishedAt: null,
    };

    expect(importSchema.parse(value)).toEqual(value);
  });
});

describe('importErrorSchema (docs/05 §5.5)', () => {
  const errors = [{ field: 'email', code: 'INVALID_EMAIL', message: 'E-mail inválido.' }];

  it('aceita linha com conteúdo original', () => {
    const line = { lineNumber: 17, raw: { nome: 'João', email: 'joao@' }, errors };

    expect(importErrorSchema.parse(line)).toEqual(line);
  });

  it('aceita linha expurgada (RN15)', () => {
    expect(
      importErrorSchema.parse({ lineNumber: 3, raw: null, rawPurged: true, errors }),
    ).toMatchObject({
      raw: null,
      rawPurged: true,
    });
  });

  it('aceita DUPLICATE_IN_FILE com firstLine', () => {
    const duplicate = {
      field: 'celular',
      code: 'DUPLICATE_IN_FILE',
      message: 'Celular repetido no arquivo.',
      firstLine: 4,
    };

    expect(
      importErrorSchema.parse({ lineNumber: 9, raw: null, errors: [duplicate] }).errors,
    ).toEqual([duplicate]);
  });

  it.each([
    ['a linha do cabeçalho', { lineNumber: 1, raw: null, errors }],
    ['linha sem erros', { lineNumber: 2, raw: null, errors: [] }],
    ['código desconhecido', { lineNumber: 2, raw: null, errors: [{ ...errors[0], code: 'OOPS' }] }],
  ])('rejeita %s', (_, line) => {
    expect(importErrorSchema.safeParse(line).success).toBe(false);
  });
});

describe('queries de importação', () => {
  it.each([
    ['listImportsQuerySchema', listImportsQuerySchema],
    ['listImportErrorsQuerySchema', listImportErrorsQuerySchema],
  ])('%s aplica os padrões de paginação', (_, schema) => {
    expect(schema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });
});
