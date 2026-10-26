import { SEARCH_TERM_MAX_LENGTH } from '@contatos/contracts';
import { SearchIcon } from 'lucide-react';
import { useId } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter dispensa a espera do debounce. */
  onSubmit: () => void;
}

/** Busca por nome, e-mail ou celular (RF07); o termo não vai para a URL (RN16). */
export function SearchInput({ value, onChange, onSubmit }: SearchInputProps) {
  const id = useId();

  return (
    <form
      role="search"
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Label htmlFor={id}>Buscar</Label>
      <div className="relative">
        <SearchIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          type="search"
          placeholder="Nome, e-mail ou celular"
          autoComplete="off"
          maxLength={SEARCH_TERM_MAX_LENGTH}
          enterKeyHint="search"
          className="pl-9"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      </div>
    </form>
  );
}
