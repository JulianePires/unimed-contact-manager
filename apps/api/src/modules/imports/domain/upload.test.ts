import { importSchema } from '@contatos/contracts';
import { describe, expect, it } from 'vitest';

import { importAlreadyExists, missingFile } from './errors';
import { IMPORT_TEMPLATE_CSV, isImportId, storedFileName, toImport } from './import';
import { isCsvUpload, type UploadedFile } from './upload';

const csv = new TextEncoder().encode('nome;email;celular\n');
const file = (overrides: Partial<UploadedFile> = {}): UploadedFile => ({
  fileName: 'contatos.csv',
  mimeType: 'text/csv',
  content: csv,
  ...overrides,
});

describe('isCsvUpload (RN10, UC12 FE1)', () => {
  it.each([
    'text/csv',
    'application/csv',
    'text/plain',
    'application/vnd.ms-excel',
    'application/octet-stream',
    'TEXT/CSV',
  ])('aceita .csv enviado como %s', (mimeType) => {
    expect(isCsvUpload(file({ mimeType }))).toBe(true);
  });

  it.each([
    ['extensão .xlsx', { fileName: 'contatos.xlsx' }],
    ['sem extensão', { fileName: 'contatos' }],
    ['tipo de imagem', { mimeType: 'image/png' }],
    ['conteúdo binário', { content: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]) }],
  ])('recusa %s', (_, overrides) => {
    expect(isCsvUpload(file(overrides))).toBe(false);
  });

  it('aceita extensão em maiúsculas', () => {
    expect(isCsvUpload(file({ fileName: 'CONTATOS.CSV' }))).toBe(true);
  });
});

describe('storedFileName', () => {
  it.each([
    ['clientes.csv', 'clientes.csv'],
    ['C:\\Users\\ana\\clientes.csv', 'clientes.csv'],
    ['/home/ana/clientes.csv', 'clientes.csv'],
    ['  clientes.csv ', 'clientes.csv'],
    ['C:\\pasta\\', 'contatos.csv'],
    ['', 'contatos.csv'],
  ])('%j → %j', (fileName, stored) => {
    expect(storedFileName(fileName)).toBe(stored);
  });

  it('limita a 255 caracteres (tamanho da coluna)', () => {
    expect(storedFileName(`${'a'.repeat(300)}.csv`)).toHaveLength(255);
  });
});

describe('toImport e isImportId', () => {
  const record = {
    id: '0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e',
    fileName: 'clientes.csv',
    status: 'PROCESSING' as const,
    totalRows: 10,
    processedRows: 4,
    createdCount: 3,
    skippedCount: 1,
    failedCount: 0,
    failureReason: null,
    createdAt: new Date('2026-10-26T12:00:00.000Z'),
    startedAt: new Date('2026-10-26T12:00:01.000Z'),
    finishedAt: null,
  };

  it('produz o recurso Import do contrato com datas ISO', () => {
    expect(importSchema.parse(toImport(record))).toMatchObject({
      createdAt: '2026-10-26T12:00:00.000Z',
      startedAt: '2026-10-26T12:00:01.000Z',
      finishedAt: null,
    });
    expect(toImport({ ...record, startedAt: null }).startedAt).toBeNull();
  });

  it('reconhece só UUIDs como id', () => {
    expect(isImportId(record.id)).toBe(true);
    expect(isImportId('template.csv')).toBe(false);
  });
});

describe('IMPORT_TEMPLATE_CSV (RF20)', () => {
  it('tem BOM, cabeçalho do docs/05 e dois exemplos em `;`', () => {
    expect(IMPORT_TEMPLATE_CSV.split('\r\n')).toEqual([
      '\uFEFFnome;email;celular;telefone',
      'Maria Silva;maria@empresa.com;(81) 99999-0000;(81) 3333-0000',
      'João Souza;joao@empresa.com;(81) 98888-1111;',
      '',
    ]);
  });
});

describe('erros da importação', () => {
  it('reenvio do mesmo arquivo informa a importação anterior (RN13)', () => {
    expect(
      importAlreadyExists({ id: 'anterior', createdAt: new Date('2026-10-20T10:00:00.000Z') }),
    ).toMatchObject({
      status: 409,
      code: 'IMPORT_ALREADY_EXISTS',
      extras: { importId: 'anterior', importedAt: '2026-10-20T10:00:00.000Z' },
    });
  });

  it('arquivo ausente vira 422 no campo file', () => {
    expect(missingFile()).toMatchObject({
      status: 422,
      extras: { errors: [expect.objectContaining({ field: 'file', code: 'REQUIRED' })] },
    });
  });
});
