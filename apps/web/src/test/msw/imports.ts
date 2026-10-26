import {
  type Import,
  type ImportError,
  importErrorSchema,
  importSchema,
  listImportErrorsQuerySchema,
  listImportsQuerySchema,
  pageMeta,
  pageSchema,
} from '@contatos/contracts';
import { HttpResponse, http } from 'msw';

import { problem } from './problem';

const IMPORTS = '/api/v1/imports';

interface StoredImport {
  item: Import;
  content: string;
  /** Próximos estados devolvidos, um por consulta do polling. */
  script: Partial<Import>[];
  errors: ImportError[];
}

function importId(n: number): string {
  return `0192f3a1-0000-7000-9000-${String(n).padStart(12, '0')}`;
}

function errorRows(count: number): ImportError[] {
  return Array.from({ length: count }, (_, index) =>
    importErrorSchema.parse({
      lineNumber: index + 2,
      raw: {
        nome: `Pessoa ${String(index + 1)}`,
        email: 'sem-arroba',
        celular: '8133330000',
        telefone: '',
      },
      errors: [
        { field: 'email', code: 'INVALID_EMAIL', message: 'Informe um e-mail válido.' },
        {
          field: 'celular',
          code: 'NOT_A_MOBILE_NUMBER',
          message: 'Informe um número de celular válido.',
        },
      ],
    }),
  );
}

function stored(n: number, changes: Partial<Import>, content: string, errors = 0): StoredImport {
  const createdAt = new Date(Date.UTC(2026, 9, 10 + n, 12)).toISOString();
  return {
    item: importSchema.parse({
      id: importId(n),
      fileName: `agenda-${String(n)}.csv`,
      status: 'COMPLETED',
      totalRows: 10,
      processedRows: 10,
      createdCount: 10 - errors,
      skippedCount: 0,
      failedCount: errors,
      failureReason: null,
      createdAt,
      startedAt: createdAt,
      finishedAt: createdAt,
      ...changes,
    }),
    content,
    script: [],
    errors: errorRows(errors),
  };
}

/** Histórico simulado: só importações terminadas, para não acionar o aviso de processamento. */
function seed(): StoredImport[] {
  return [
    stored(1, { fileName: 'clientes-setembro.csv' }, 'conteudo-setembro'),
    stored(
      2,
      { fileName: 'fornecedores.csv', status: 'COMPLETED_WITH_ERRORS' },
      'conteudo-fornecedores',
      3,
    ),
    stored(
      3,
      {
        fileName: 'planilha-errada.csv',
        status: 'FAILED',
        totalRows: 0,
        processedRows: 0,
        createdCount: 0,
        failureReason: 'Cabeçalho sem a coluna obrigatória "celular".',
      },
      'conteudo-errado',
    ),
  ];
}

let imports = seed();
let sequence = 100;

export function resetImports(): void {
  imports = seed();
  sequence = 100;
}

export function findImport(fileName: string): StoredImport {
  const found = imports.find((entry) => entry.item.fileName === fileName);
  if (!found) throw new Error(`Importação de teste inexistente: ${fileName}`);
  return found;
}

/** Roteiro do processamento conforme o nome do arquivo enviado. */
function scriptFor(fileName: string): { script: Partial<Import>[]; errors: number } {
  if (fileName.includes('falha')) {
    return {
      script: [
        { status: 'PROCESSING', startedAt: new Date().toISOString() },
        {
          status: 'FAILED',
          failureReason: 'Cabeçalho sem a coluna obrigatória "email".',
          finishedAt: new Date().toISOString(),
        },
      ],
      errors: 0,
    };
  }
  const errors = fileName.includes('erros') ? 25 : 0;
  return {
    script: [
      {
        status: 'PROCESSING',
        totalRows: 100,
        processedRows: 0,
        startedAt: new Date().toISOString(),
      },
      {
        status: 'PROCESSING',
        totalRows: 100,
        processedRows: 40,
        createdCount: 30,
        skippedCount: 0,
        failedCount: 10,
      },
      {
        status: errors > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
        totalRows: 100,
        processedRows: 100,
        createdCount: 100 - errors - 5,
        skippedCount: 5,
        failedCount: errors,
        finishedAt: new Date().toISOString(),
      },
    ],
    errors,
  };
}

/**
 * Arquivo do multipart lido do texto: sob o jsdom, `request.formData()` do Node não consegue criar
 * o File (o construtor global é o do jsdom). Basta para o campo único `file` do envio.
 */
async function readUpload(
  request: Request,
): Promise<{ name: string; content: string } | undefined> {
  const boundary = request.headers.get('content-type')?.split('boundary=')[1];
  const body = await request.text();
  const name = /filename="([^"]*)"/.exec(body)?.[1];
  if (!boundary || name === undefined) return undefined;
  const start = body.indexOf('\r\n\r\n') + 4;
  return { name, content: body.slice(start, body.indexOf(`\r\n--${boundary}`, start)) };
}

function byId(id: unknown): StoredImport | undefined {
  return imports.find((entry) => entry.item.id === id);
}

function notFound() {
  return problem('NOT_FOUND', 'Importação não encontrada');
}

export const importHandlers = [
  http.get(IMPORTS, ({ request }) => {
    const query = listImportsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const sorted = imports
      .map((entry) => entry.item)
      .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = (query.page - 1) * query.pageSize;
    return HttpResponse.json(
      pageSchema(importSchema).parse({
        data: sorted.slice(start, start + query.pageSize),
        meta: pageMeta(query, sorted.length),
      }),
    );
  }),

  http.post(IMPORTS, async ({ request }) => {
    const force = new URL(request.url).searchParams.get('force') === 'true';
    const file = await readUpload(request);
    if (!file) return problem('VALIDATION_ERROR', 'Envie o arquivo');
    const { content } = file;
    const previous = imports.find((entry) => entry.content === content);
    if (previous && !force) {
      return problem('IMPORT_ALREADY_EXISTS', 'Este arquivo já foi importado', {
        importId: previous.item.id,
        importedAt: previous.item.createdAt,
      });
    }
    sequence += 1;
    const { script, errors } = scriptFor(file.name);
    const entry: StoredImport = {
      item: importSchema.parse({
        id: importId(sequence),
        fileName: file.name,
        status: 'PENDING',
        totalRows: 0,
        processedRows: 0,
        createdCount: 0,
        skippedCount: 0,
        failedCount: 0,
        failureReason: null,
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      }),
      content,
      script,
      errors: errorRows(errors),
    };
    imports = [...imports, entry];
    return HttpResponse.json(entry.item, {
      status: 202,
      headers: { location: `${IMPORTS}/${entry.item.id}` },
    });
  }),

  /** Cada consulta avança um passo do roteiro: é o que o polling vê (UC13). */
  http.get(`${IMPORTS}/:id`, ({ params }) => {
    const entry = byId(params['id']);
    if (!entry) return notFound();
    const next = entry.script.shift();
    if (next) entry.item = importSchema.parse({ ...entry.item, ...next });
    return HttpResponse.json(entry.item);
  }),

  http.get(`${IMPORTS}/:id/errors`, ({ params, request }) => {
    const entry = byId(params['id']);
    if (!entry) return notFound();
    const query = listImportErrorsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    const start = (query.page - 1) * query.pageSize;
    return HttpResponse.json(
      pageSchema(importErrorSchema).parse({
        data: entry.errors.slice(start, start + query.pageSize),
        meta: pageMeta(query, entry.errors.length),
      }),
    );
  }),

  http.delete(`${IMPORTS}/:id`, ({ params }) => {
    if (!byId(params['id'])) return notFound();
    imports = imports.filter((entry) => entry.item.id !== params['id']);
    return new HttpResponse(null, { status: 204 });
  }),
];
