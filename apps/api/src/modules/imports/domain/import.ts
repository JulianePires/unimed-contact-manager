import type { Import, ImportStatus } from '@contatos/contracts';
import { z } from 'zod';

import { formatCsvLine } from './csv-escape';
import { CONTACT_FIELDS, CSV_COLUMNS } from './csv-sniffer';

/** Importação como persistida (tabela `imports`). */
export interface ImportRecord {
  id: string;
  fileName: string;
  status: ImportStatus;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  skippedCount: number;
  failedCount: number;
  failureReason: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

const importIdSchema = z.uuid();

/** Id malformado nunca identifica uma importação: 404 sem consultar o banco. */
export function isImportId(id: string): boolean {
  return importIdSchema.safeParse(id).success;
}

export function toImport(record: ImportRecord): Import {
  return {
    id: record.id,
    fileName: record.fileName,
    status: record.status,
    totalRows: record.totalRows,
    processedRows: record.processedRows,
    createdCount: record.createdCount,
    skippedCount: record.skippedCount,
    failedCount: record.failedCount,
    failureReason: record.failureReason,
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
  };
}

/** Nome guardado para o arquivo: sem caminho (alguns navegadores enviam `C:\…\arquivo.csv`). */
export function storedFileName(fileName: string): string {
  const separator = Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\'));
  const base = fileName.slice(separator + 1).trim();
  return base === '' ? 'contatos.csv' : base.slice(0, 255);
}

const BOM = '\uFEFF';

/**
 * CSV modelo (RF20, docs/05): cabeçalho e dois exemplos, em `;` e UTF-8 com BOM, que é o que o
 * Excel em pt-BR abre com os acentos corretos.
 */
export const IMPORT_TEMPLATE_CSV = `${BOM}${[
  CONTACT_FIELDS.map((field) => CSV_COLUMNS[field]),
  ['Maria Silva', 'maria@empresa.com', '(81) 99999-0000', '(81) 3333-0000'],
  ['João Souza', 'joao@empresa.com', '(81) 98888-1111', ''],
]
  .map((cells) => formatCsvLine(cells, ';'))
  .join('\r\n')}\r\n`;
