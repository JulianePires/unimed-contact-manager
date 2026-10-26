import { useId } from 'react';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { StatusFilter as Status } from '../api';

const OPTIONS: { value: Status; label: string }[] = [
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
  { value: 'all', label: 'Todos' },
];

interface StatusFilterProps {
  value: Status;
  onChange: (value: Status) => void;
}

/** Filtro por status (RF08); ativos por padrão, como na API. */
export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const id = useId();

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>Status</Label>
      <Select
        value={value}
        onValueChange={(next) => {
          const option = OPTIONS.find((item) => item.value === next);
          if (option) onChange(option.value);
        }}
      >
        <SelectTrigger id={id} className="sm:w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
