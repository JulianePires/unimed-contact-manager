import iconv from 'iconv-lite';

export type CsvEncoding = 'utf-8' | 'windows-1252';
export type CsvDelimiter = ',' | ';';

/** Colunas do CSV (docs/05 "Formato do CSV") e o campo de contato que cada uma alimenta. */
export const CSV_COLUMNS = {
  name: 'nome',
  email: 'email',
  mobile: 'celular',
  phone: 'telefone',
} as const;
export type ContactField = keyof typeof CSV_COLUMNS;
export const CONTACT_FIELDS: readonly ContactField[] = ['name', 'email', 'mobile', 'phone'];
export type CsvColumn = (typeof CSV_COLUMNS)[ContactField];

const HEADER_ALIASES: Readonly<Record<string, ContactField>> = {
  nome: 'name',
  email: 'email',
  'e-mail': 'email',
  celular: 'mobile',
  telefone: 'phone',
};
const REQUIRED_FIELDS: readonly ContactField[] = ['name', 'email', 'mobile'];

const utf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * UTF-8 estrito primeiro (o BOM é descartado pelo decoder); se houver byte inválido, o arquivo
 * veio do Excel em pt-BR e é lido como Windows-1252 (ADR-002).
 */
export function decodeCsv(bytes: Uint8Array): { text: string; encoding: CsvEncoding } {
  try {
    return { text: utf8.decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: iconv.decode(Buffer.from(bytes), 'win1252'), encoding: 'windows-1252' };
  }
}

/** Delimitador pelo cabeçalho: o que mais aparece fora de aspas entre `;` e `,`. */
export function detectDelimiter(text: string): CsvDelimiter {
  const counts = { ',': 0, ';': 0 };
  let quoted = false;
  for (const char of text.trimStart()) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && (char === ',' || char === ';')) counts[char] += 1;
  }
  return counts[';'] > counts[','] ? ';' : ',';
}

/** `" E-MAIL "` → `e-mail`, `Célular` → `celular`: sem caixa, acentos ou espaços nas pontas. */
export function normalizeHeaderCell(cell: string): string {
  return cell
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

export type ColumnIndexes = Readonly<Partial<Record<ContactField, number>>> & {
  readonly name: number;
  readonly email: number;
  readonly mobile: number;
};

export type HeaderValidation =
  | { ok: true; columns: ColumnIndexes; columnCount: number }
  | { ok: false; reason: string };

/** Cabeçalho obrigatório, ordem livre; colunas desconhecidas são ignoradas (RN10). */
export function validateHeader(cells: readonly string[]): HeaderValidation {
  const columns: Partial<Record<ContactField, number>> = {};
  for (const [index, cell] of cells.entries()) {
    const field = HEADER_ALIASES[normalizeHeaderCell(cell)];
    if (field === undefined) continue;
    if (columns[field] !== undefined) {
      return { ok: false, reason: `Coluna "${CSV_COLUMNS[field]}" repetida no cabeçalho.` };
    }
    columns[field] = index;
  }
  const missing = REQUIRED_FIELDS.filter((field) => columns[field] === undefined);
  const { name, email, mobile } = columns;
  if (name === undefined || email === undefined || mobile === undefined) {
    const names = missing.map((field) => CSV_COLUMNS[field]).join(', ');
    return { ok: false, reason: `Cabeçalho sem as colunas obrigatórias: ${names}.` };
  }
  return { ok: true, columns: { ...columns, name, email, mobile }, columnCount: cells.length };
}
