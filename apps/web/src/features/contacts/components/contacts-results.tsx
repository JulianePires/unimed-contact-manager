import type { ContactSort } from '@contatos/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useDeferredValue, useEffect } from 'react';

import { announce } from '@/lib/a11y/announce';
import { pluralize } from '@/lib/format';

import { type ContactsQuery, contactsQueryOptions } from '../api';
import { ContactsTable } from './contacts-table';
import { EmptyState } from './empty-state';

interface ContactsResultsProps {
  query: ContactsQuery;
  /** Há busca ou filtro além do padrão: lista vazia significa "sem resultado", não agenda vazia. */
  filtered: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (sort: ContactSort) => void;
  onClear: () => void;
}

/**
 * Resultado da lista. Com `useDeferredValue`, a tabela atual continua visível (e marcada como
 * ocupada) enquanto a nova consulta carrega, sem voltar ao fallback do Suspense (docs/06 §6.5).
 */
export function ContactsResults({
  query,
  filtered,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onClear,
}: ContactsResultsProps) {
  const deferredQuery = useDeferredValue(query);
  const { data } = useSuspenseQuery(contactsQueryOptions(deferredQuery));
  const { total } = data.meta;
  const resultKey = JSON.stringify(deferredQuery);
  const busy = resultKey !== JSON.stringify(query);

  useEffect(() => {
    announce(pluralize(total, 'contato encontrado', 'contatos encontrados'));
  }, [resultKey, total]);

  if (data.data.length === 0) {
    return filtered ? (
      <EmptyState kind="no-results" term={deferredQuery.q} onClear={onClear} />
    ) : (
      <EmptyState kind="empty" />
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {pluralize(total, 'contato encontrado', 'contatos encontrados')}
      </p>
      <ContactsTable
        contacts={data.data}
        meta={data.meta}
        sort={deferredQuery.sort}
        busy={busy}
        onSortChange={onSortChange}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
}
