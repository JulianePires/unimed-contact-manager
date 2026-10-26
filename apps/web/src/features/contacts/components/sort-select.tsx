import type { ContactSort } from '@contatos/contracts';
import { useId } from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const SORT_LABELS: Record<ContactSort, string> = {
  name: 'Nome (A–Z)',
  '-name': 'Nome (Z–A)',
  '-createdAt': 'Mais recentes',
  createdAt: 'Mais antigos',
};

const SORTS = Object.keys(SORT_LABELS) as ContactSort[];

interface SortSelectProps {
  value: ContactSort;
  onChange: (value: ContactSort) => void;
}

/** Ordenação da lista (RF06). */
export function SortSelect({ value, onChange }: SortSelectProps) {
  const id = useId();

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Ordenar por</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          const sort = SORTS.find((item) => item === next);
          if (sort) onChange(sort);
        }}
      >
        <SelectTrigger id={id} className="sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORTS.map((sort) => (
            <SelectItem key={sort} value={sort}>
              {SORT_LABELS[sort]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
