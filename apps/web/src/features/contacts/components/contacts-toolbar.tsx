import type { ContactSort } from '@contatos/contracts';

import type { ContactsFilters, StatusFilter as Status } from '../api';
import { FavoriteFilter } from './favorite-filter';
import { SearchInput } from './search-input';
import { SortSelect } from './sort-select';
import { StatusFilter } from './status-filter';

interface ContactsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  filters: Pick<ContactsFilters, 'status' | 'favorite' | 'sort'>;
  onStatusChange: (status: Status) => void;
  onFavoriteChange: (favorite: boolean | undefined) => void;
  onSortChange: (sort: ContactSort) => void;
}

export function ContactsToolbar({
  search,
  onSearchChange,
  onSearchSubmit,
  filters,
  onStatusChange,
  onFavoriteChange,
  onSortChange,
}: ContactsToolbarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="sm:min-w-64 sm:flex-1">
        <SearchInput value={search} onChange={onSearchChange} onSubmit={onSearchSubmit} />
      </div>
      <StatusFilter value={filters.status} onChange={onStatusChange} />
      <SortSelect value={filters.sort} onChange={onSortChange} />
      <FavoriteFilter
        pressed={filters.favorite === true}
        onPressedChange={(pressed) => {
          onFavoriteChange(pressed || undefined);
        }}
      />
    </div>
  );
}
