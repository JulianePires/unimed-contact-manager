import type { RowData } from '@tanstack/react-table';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { ServerTable } from './data-table';

export const PAGE_SIZES = [10, 20, 50, 100] as const;

/** Tamanho da página e navegação entre páginas, lidos e alterados pela API da tabela. */
export function DataTablePagination<TData extends RowData>({
  table,
}: {
  table: ServerTable<TData>;
}) {
  const sizeId = useId();
  const { pageIndex, pageSize } = table.state.pagination;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <Label htmlFor={sizeId} className="whitespace-nowrap">
          Por página
        </Label>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => {
            table.setPageSize(Number(value));
          }}
        >
          <SelectTrigger id={sizeId} className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <nav aria-label="Paginação" className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!table.getCanPreviousPage()}
          onClick={() => {
            table.previousPage();
          }}
        >
          <ChevronLeftIcon aria-hidden="true" />
          Anterior
        </Button>
        <p className="px-2 text-sm text-muted-foreground">
          Página {pageIndex + 1} de {Math.max(table.getPageCount(), 1)}
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={!table.getCanNextPage()}
          onClick={() => {
            table.nextPage();
          }}
        >
          Próxima
          <ChevronRightIcon aria-hidden="true" />
        </Button>
      </nav>
    </div>
  );
}
