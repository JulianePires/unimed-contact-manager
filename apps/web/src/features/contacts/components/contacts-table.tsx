import type { Contact, ContactSort, PageMeta } from '@contatos/contracts';
import {
  createColumnHelper,
  functionalUpdate,
  type PaginationState,
  type SortingState,
  useTable,
} from '@tanstack/react-table';
import { Link } from '@tanstack/react-router';

import { DataTable, serverTableFeatures } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { formatDate } from '@/lib/format';

import { FavoriteToggle } from './favorite-toggle';
import { SORT_LABELS } from './sort-select';
import { StatusBadge } from './status-badge';

const column = createColumnHelper<typeof serverTableFeatures, Contact>();

/** Ações levam o nome do contato no nome acessível (docs/06 §6.7). */
const columns = column.columns([
  column.display({
    id: 'favorite',
    header: () => <span className="sr-only">Favorito</span>,
    cell: ({ row }) => <FavoriteToggle contact={row.original} />,
    meta: { className: 'w-12 pr-0' },
  }),
  column.accessor('name', {
    header: 'Nome',
    enableSorting: true,
    cell: ({ row, getValue }) => (
      <Link
        to="/contatos/$id"
        params={{ id: row.original.id }}
        className="underline-offset-2 hover:underline"
      >
        {getValue()}
      </Link>
    ),
    meta: { rowHeader: true },
  }),
  column.accessor('email', {
    header: 'E-mail',
    meta: { className: 'text-muted-foreground' },
  }),
  column.accessor('mobileFormatted', {
    header: 'Celular',
    meta: { className: 'whitespace-nowrap tabular-nums' },
  }),
  column.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={getValue()} />,
  }),
  column.accessor('createdAt', {
    header: 'Cadastrado em',
    enableSorting: true,
    sortDescFirst: true,
    cell: ({ getValue }) => formatDate(getValue()),
    meta: { className: 'whitespace-nowrap text-muted-foreground tabular-nums' },
  }),
]);

const SORTABLE = ['name', 'createdAt'] as const;

function toSorting(sort: ContactSort): SortingState {
  return [{ id: sort.replace('-', ''), desc: sort.startsWith('-') }];
}

function toContactSort([first]: SortingState): ContactSort | undefined {
  const id = SORTABLE.find((sortable) => sortable === first?.id);
  if (!first || !id) return undefined;
  return first.desc ? `-${id}` : id;
}

interface ContactsTableProps {
  contacts: Contact[];
  meta: PageMeta;
  sort: ContactSort;
  busy?: boolean;
  onSortChange: (sort: ContactSort) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

/**
 * Lista de contatos com TanStack Table (ADR-008). Ordenação e paginação são da API: a tabela
 * recebe a página pronta e traduz cliques em mudanças de URL (`sort`, `page`, `pageSize`).
 */
export function ContactsTable({
  contacts,
  meta,
  sort,
  busy = false,
  onSortChange,
  onPageChange,
  onPageSizeChange,
}: ContactsTableProps) {
  const sorting = toSorting(sort);
  const pagination: PaginationState = { pageIndex: meta.page - 1, pageSize: meta.pageSize };

  const table = useTable({
    features: serverTableFeatures,
    columns,
    data: contacts,
    getRowId: (contact) => contact.id,
    rowCount: meta.total,
    manualSorting: true,
    manualPagination: true,
    defaultColumn: { enableSorting: false },
    enableMultiSort: false,
    enableSortingRemoval: false,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      const next = toContactSort(functionalUpdate(updater, sorting));
      if (next) onSortChange(next);
    },
    onPaginationChange: (updater) => {
      const next = functionalUpdate(updater, pagination);
      if (next.pageSize !== pagination.pageSize) onPageSizeChange(next.pageSize);
      else onPageChange(next.pageIndex + 1);
    },
  });

  return (
    <div className="grid gap-4">
      <DataTable
        table={table}
        caption={`Contatos, ordenados por ${SORT_LABELS[sort].toLowerCase()}`}
        busy={busy}
      />
      <DataTablePagination table={table} />
    </div>
  );
}
