import type { ImportError } from '@contatos/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  functionalUpdate,
  type PaginationState,
  useTable,
} from '@tanstack/react-table';

import { DataTable, serverTableFeatures } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';

import { importErrorsQueryOptions } from '../api';

const column = createColumnHelper<typeof serverTableFeatures, ImportError>();

const columns = column.columns([
  column.accessor('lineNumber', {
    header: 'Linha',
    meta: { rowHeader: true, className: 'w-16 tabular-nums' },
  }),
  column.accessor('raw', {
    header: 'Dados originais',
    cell: ({ getValue }) => {
      const raw = getValue();
      if (!raw) return <span className="text-muted-foreground">Descartados após 30 dias</span>;
      return (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-2 text-xs">
          {Object.entries(raw).map(([key, value]) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="break-all">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      );
    },
  }),
  column.accessor('errors', {
    header: 'Motivos',
    cell: ({ getValue }) => (
      <ul className="grid gap-1">
        {getValue().map(({ field, code, message }) => (
          <li key={`${field}-${code}`}>{message}</li>
        ))}
      </ul>
    ),
  }),
]);

interface ImportErrorsTableProps {
  importId: string;
  page: number;
  onPageChange: (page: number) => void;
}

/** Linhas rejeitadas com os motivos por campo, paginadas pela API (RF18, UC14). */
export function ImportErrorsTable({ importId, page, onPageChange }: ImportErrorsTableProps) {
  const { data } = useSuspenseQuery(importErrorsQueryOptions(importId, page));
  const pagination: PaginationState = {
    pageIndex: data.meta.page - 1,
    pageSize: data.meta.pageSize,
  };
  const table = useTable({
    features: serverTableFeatures,
    columns,
    data: data.data,
    getRowId: (row) => String(row.lineNumber),
    rowCount: data.meta.total,
    manualSorting: true,
    manualPagination: true,
    defaultColumn: { enableSorting: false },
    state: { pagination },
    onPaginationChange: (updater) => {
      onPageChange(functionalUpdate(updater, pagination).pageIndex + 1);
    },
  });
  const purged = data.data.some((row) => row.raw === null);

  return (
    <div className="grid gap-4">
      {purged && (
        <p className="text-sm text-muted-foreground">
          Os dados originais destas linhas foram descartados após 30 dias (LGPD). Os motivos
          continuam disponíveis.
        </p>
      )}
      <DataTable table={table} caption="Linhas com erro e seus motivos" />
      <DataTablePagination table={table} pageSizeSelect={false} />
    </div>
  );
}
