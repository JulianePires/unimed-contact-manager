import {
  type Header,
  metaHelper,
  type ReactTable,
  type RowData,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
} from '@tanstack/react-table';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import { useId } from 'react';

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface DataTableColumnMeta {
  /** Célula que identifica a linha (ex.: nome): vira `<th scope="row">`. */
  rowHeader?: boolean;
  className?: string;
}

/**
 * Listagens paginadas e ordenadas pela API (ADR-008): a tabela só descreve colunas e estado; o
 * servidor entrega a página já ordenada (`manualSorting` / `manualPagination`).
 */
export const serverTableFeatures = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
});
export type ServerTableFeatures = typeof serverTableFeatures;
export type ServerTable<TData extends RowData> = ReactTable<ServerTableFeatures, TData>;

interface DataTableProps<TData extends RowData> {
  table: ServerTable<TData>;
  caption: string;
  busy?: boolean;
}

/**
 * Marcação semântica de qualquer listagem (docs/06 §6.7): `<caption>`, `scope`, `aria-sort` e
 * área de rolagem horizontal focável pelo teclado (telas a partir de 320 px).
 */
export function DataTable<TData extends RowData>({
  table,
  caption,
  busy = false,
}: DataTableProps<TData>) {
  const captionId = useId();

  return (
    <Table
      aria-busy={busy}
      className="min-w-2xl"
      containerProps={{
        role: 'region',
        tabIndex: 0,
        'aria-labelledby': captionId,
        className: cn('rounded-md border border-border', busy && 'opacity-60'),
      }}
    >
      <TableCaption id={captionId} className="sr-only">
        {caption}
      </TableCaption>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="hover:bg-transparent">
            {group.headers.map((header) => (
              <DataTableHead key={header.id} header={header} table={table} />
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getAllCells().map((cell) => {
              const meta = cell.column.columnDef.meta;
              const content = <table.FlexRender cell={cell} />;
              return meta?.rowHeader ? (
                <TableHead
                  key={cell.id}
                  scope="row"
                  className={cn('font-medium text-foreground', meta.className)}
                >
                  {content}
                </TableHead>
              ) : (
                <TableCell key={cell.id} className={meta?.className}>
                  {content}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;
const SORT_ICON = { asc: ArrowUpIcon, desc: ArrowDownIcon } as const;

function DataTableHead<TData extends RowData>({
  header,
  table,
}: {
  header: Header<ServerTableFeatures, TData>;
  table: ServerTable<TData>;
}) {
  const content = header.isPlaceholder ? null : <table.FlexRender header={header} />;
  const className = header.column.columnDef.meta?.className;

  if (!header.column.getCanSort()) {
    return <TableHead className={className}>{content}</TableHead>;
  }

  const direction = header.column.getIsSorted();
  const Icon = direction ? SORT_ICON[direction] : ArrowUpDownIcon;

  return (
    <TableHead aria-sort={direction ? ARIA_SORT[direction] : 'none'} className={className}>
      <button
        type="button"
        className="-mx-2 inline-flex min-h-8 items-center gap-1 rounded-sm px-2 hover:text-foreground"
        onClick={header.column.getToggleSortingHandler()}
      >
        {content}
        <Icon aria-hidden="true" className="size-3.5" />
      </button>
    </TableHead>
  );
}
