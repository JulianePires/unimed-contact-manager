import { createFileRoute, Link, stripSearchParams } from '@tanstack/react-router';
import { SearchXIcon } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { loadImport } from '@/features/imports/api';
import { ImportDetail } from '@/features/imports/components/import-detail';

const DEFAULT_SEARCH = { errorsPage: 1 };

const searchSchema = z.object({
  errorsPage: z
    .number()
    .int()
    .min(1)
    .default(DEFAULT_SEARCH.errorsPage)
    .catch(DEFAULT_SEARCH.errorsPage),
});

export const Route = createFileRoute('/_auth/importacoes/$id')({
  validateSearch: searchSchema,
  search: { middlewares: [stripSearchParams(DEFAULT_SEARCH)] },
  loader: ({ context, params }) => loadImport(context.queryClient, params.id),
  component: ImportPage,
  notFoundComponent: ImportNotFound,
});

function ImportPage() {
  const { id } = Route.useParams();
  const { errorsPage } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <>
      <title>Importação · Agenda Unimed</title>
      <ImportDetail
        importId={id}
        errorsPage={errorsPage}
        onErrorsPageChange={(page) => {
          void navigate({ search: { errorsPage: page } });
        }}
      />
    </>
  );
}

function ImportNotFound() {
  return (
    <>
      <title>Importação não encontrada · Agenda Unimed</title>
      <div className="grid justify-items-start gap-3">
        <SearchXIcon aria-hidden="true" className="size-8 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Importação não encontrada</h1>
        <p className="text-muted-foreground">
          O link pode estar incorreto ou a importação foi excluída.
        </p>
        <Button asChild variant="secondary">
          <Link to="/importacoes">Voltar para importações</Link>
        </Button>
      </div>
    </>
  );
}
