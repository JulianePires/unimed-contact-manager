import type { Import, Page } from '@contatos/contracts';
import { Link } from '@tanstack/react-router';
import {
  createColumnHelper,
  functionalUpdate,
  type PaginationState,
  useTable,
} from '@tanstack/react-table';

import { DataTable, serverTableFeatures } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { formatCount, formatDateTime } from '@/lib/format';

import { ImportStatusBadge } from './import-status-badge';

const column = createColumnHelper<typeof serverTableFeatures, Import>();
const NUMERIC = 'text-right tabular-nums';

const columns = column.columns([
  column.accessor('fileName', {
    header: 'Arquivo',
    cell: ({ row, getValue }) => (
      <Link
        to="/importacoes/$id"
        params={{ id: row.original.id }}
        className="underline-offset-2 hover:underline"
      >
        {getValue()}
      </Link>
    ),
    meta: { rowHeader: true },
  }),
  column.accessor('status', {
    header: 'Status',
    cell: ({ getValue }) => <ImportStatusBadge status={getValue()} />,
  }),
  column.accessor('createdAt', {
    header: 'Enviada em',
    cell: ({ getValue }) => formatDateTime(getValue()),
    meta: { className: 'whitespace-nowrap text-muted-foreground tabular-nums' },
  }),
  column.accessor('createdCount', {
    header: 'Criados',
    cell: ({ getValue }) => formatCount(getValue()),
    meta: { className: NUMERIC },
  }),
  column.accessor('skippedCount', {
    header: 'Ignorados',
    cell: ({ getValue }) => formatCount(getValue()),
    meta: { className: NUMERIC },
  }),
  column.accessor('failedCount', {
    header: 'Com erro',
    cell: ({ getValue }) => formatCount(getValue()),
    meta: { className: NUMERIC },
  }),
]);

interface ImportHistoryTableProps {
  page: Page<Import>;
  onPageChange: (page: number) => void;
}

/** Histórico de importações, mais recentes primeiro (RF21). */
export function ImportHistoryTable({ page, onPageChange }: ImportHistoryTableProps) {
  const pagination: PaginationState = {
    pageIndex: page.meta.page - 1,
    pageSize: page.meta.pageSize,
  };
  const table = useTable({
    features: serverTableFeatures,
    columns,
    data: page.data,
    getRowId: (item) => item.id,
    rowCount: page.meta.total,
    manualSorting: true,
    manualPagination: true,
    defaultColumn: { enableSorting: false },
    state: { pagination },
    onPaginationChange: (updater) => {
      onPageChange(functionalUpdate(updater, pagination).pageIndex + 1);
    },
  });

  return (
    <div className="grid gap-4">
      <DataTable table={table} caption="Importações, das mais recentes para as mais antigas" />
      <DataTablePagination table={table} pageSizeSelect={false} />
    </div>
  );
}
