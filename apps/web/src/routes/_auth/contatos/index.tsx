import {
  CONTACT_SORTS,
  CONTACT_STATUSES,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
} from '@contatos/contracts';
import { useQueryClient } from '@tanstack/react-query';
import {
  createFileRoute,
  Link,
  type ErrorComponentProps,
  redirect,
  stripSearchParams,
} from '@tanstack/react-router';
import { PlusIcon } from 'lucide-react';
import { Suspense } from 'react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import type { ContactsFilters } from '@/features/contacts/api';
import { ContactsResults } from '@/features/contacts/components/contacts-results';
import { ContactsToolbar } from '@/features/contacts/components/contacts-toolbar';
import { useContactSearch } from '@/features/contacts/hooks/use-contact-search';

const DEFAULT_FILTERS = {
  page: 1,
  pageSize: PAGE_SIZE_DEFAULT,
  status: 'active',
  sort: 'name',
} as const satisfies ContactsFilters;

/**
 * Só filtros não pessoais vão para a URL (docs/06 §6.1, RN16): `q` não faz parte do schema e é
 * descartado se aparecer. Valores inválidos voltam ao padrão, e os padrões não poluem a URL.
 */
const searchSchema = z.object({
  page: z.number().int().min(1).default(DEFAULT_FILTERS.page).catch(DEFAULT_FILTERS.page),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(PAGE_SIZE_MAX)
    .default(DEFAULT_FILTERS.pageSize)
    .catch(DEFAULT_FILTERS.pageSize),
  status: z
    .enum([...CONTACT_STATUSES, 'all'])
    .default(DEFAULT_FILTERS.status)
    .catch(DEFAULT_FILTERS.status),
  favorite: z.boolean().optional().catch(undefined),
  sort: z.enum(CONTACT_SORTS).default(DEFAULT_FILTERS.sort).catch(DEFAULT_FILTERS.sort),
});

export const Route = createFileRoute('/_auth/contatos/')({
  validateSearch: searchSchema,
  search: {
    middlewares: [
      stripSearchParams(DEFAULT_FILTERS),
      ({ search, next }) =>
        Object.fromEntries(
          Object.entries(next(search)).filter(([key]) => key !== 'q'),
        ) as typeof search,
    ],
  },
  beforeLoad: ({ location, search }) => {
    if ('q' in location.search) {
      redirect({ to: '/contatos', search, replace: true, throw: true });
    }
  },
  component: ContactsPage,
  errorComponent: ContactsError,
});

function ContactsPage() {
  const filters = Route.useSearch();
  const navigate = Route.useNavigate();

  const updateFilters = (patch: Partial<ContactsFilters>) => {
    void navigate({ search: (previous) => ({ ...previous, page: 1, ...patch }) });
  };
  const search = useContactSearch(() => {
    void navigate({ search: (previous) => ({ ...previous, page: 1 }), replace: true });
  });

  const filtered =
    search.term !== undefined || filters.status !== 'active' || filters.favorite === true;

  return (
    <>
      <title>Contatos · Agenda Unimed</title>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Contatos</h1>
          <Button asChild>
            <Link to="/contatos/novo">
              <PlusIcon aria-hidden="true" />
              Novo contato
            </Link>
          </Button>
        </div>
        <ContactsToolbar
          search={search.input}
          onSearchChange={search.setInput}
          onSearchSubmit={search.submit}
          filters={filters}
          onStatusChange={(status) => {
            updateFilters({ status });
          }}
          onFavoriteChange={(favorite) => {
            updateFilters({ favorite });
          }}
          onSortChange={(sort) => {
            updateFilters({ sort });
          }}
        />
        <Suspense fallback={<p className="text-muted-foreground">Carregando contatos…</p>}>
          <ContactsResults
            query={{ ...filters, q: search.term }}
            filtered={filtered}
            onPageChange={(page) => {
              void navigate({ search: (previous) => ({ ...previous, page }) });
            }}
            onPageSizeChange={(pageSize) => {
              updateFilters({ pageSize });
            }}
            onSortChange={(sort) => {
              updateFilters({ sort });
            }}
            onClear={() => {
              search.clear();
              void navigate({ search: {} });
            }}
          />
        </Suspense>
      </div>
    </>
  );
}

/** Falha ao carregar a lista: mantém o layout e permite tentar de novo, sem detalhes técnicos. */
function ContactsError({ reset }: ErrorComponentProps) {
  const queryClient = useQueryClient();

  return (
    <>
      <title>Contatos · Agenda Unimed</title>
      <h1 className="text-2xl font-semibold">Contatos</h1>
      <div role="alert" className="mt-6 rounded-md border border-danger-border p-4">
        <p className="font-semibold text-danger">Não foi possível carregar os contatos.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifique sua conexão e tente novamente.
        </p>
      </div>
      <Button
        className="mt-4"
        onClick={() => {
          void queryClient.resetQueries({ queryKey: ['contacts'] }).then(reset);
        }}
      >
        Tentar novamente
      </Button>
    </>
  );
}
