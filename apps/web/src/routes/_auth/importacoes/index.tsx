import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { Suspense } from 'react';
import { z } from 'zod';

import { importsQueryOptions } from '@/features/imports/api';
import { ImportHistoryTable } from '@/features/imports/components/import-history-table';
import { ImportUploader } from '@/features/imports/components/import-uploader';

const DEFAULT_SEARCH = { page: 1 };

const searchSchema = z.object({
  page: z.number().int().min(1).default(DEFAULT_SEARCH.page).catch(DEFAULT_SEARCH.page),
});

export const Route = createFileRoute('/_auth/importacoes/')({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(DEFAULT_SEARCH)] },
  component: ImportsPage,
});

function ImportsPage() {
  return (
    <>
      <title>Importações · Agenda Unimed</title>
      <div className="grid gap-8">
        <h1 className="text-2xl font-semibold">Importações</h1>
        <ImportUploader />
        <section aria-labelledby="historico" className="grid gap-4">
          <h2 id="historico" className="text-lg font-semibold">
            Histórico
          </h2>
          <Suspense fallback={<p className="text-muted-foreground">Carregando importações…</p>}>
            <History />
          </Suspense>
        </section>
      </div>
    </>
  );
}

function History() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(importsQueryOptions(page));

  if (data.meta.total === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhuma importação ainda. Envie um arquivo CSV para trazer seus contatos.
      </p>
    );
  }

  return (
    <ImportHistoryTable
      page={data}
      onPageChange={(next) => {
        void navigate({ search: { page: next } });
      }}
    />
  );
}
