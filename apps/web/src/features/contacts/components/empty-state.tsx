import { Link } from '@tanstack/react-router';
import { BookUserIcon, SearchXIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

type EmptyStateProps =
  | { kind: 'empty' }
  | { kind: 'no-results'; term?: string | undefined; onClear: () => void };

/** Lista vazia: agenda ainda sem contatos ou busca/filtros sem resultado. */
export function EmptyState(props: EmptyStateProps) {
  if (props.kind === 'empty') {
    return (
      <div className="grid justify-items-center gap-3 rounded-md border border-border px-4 py-12 text-center">
        <BookUserIcon aria-hidden="true" className="size-8 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Sua agenda ainda está vazia</h2>
        <p className="text-muted-foreground">Importe uma planilha CSV para trazer seus contatos.</p>
        <Button asChild variant="secondary">
          <Link to="/importacoes">Importar contatos</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid justify-items-center gap-3 rounded-md border border-border px-4 py-12 text-center">
      <SearchXIcon aria-hidden="true" className="size-8 text-muted-foreground" />
      <h2 className="text-lg font-semibold">Nenhum contato encontrado</h2>
      <p className="text-muted-foreground">
        {props.term
          ? `Nada corresponde a “${props.term}” com os filtros atuais.`
          : 'Nenhum contato corresponde aos filtros atuais.'}
      </p>
      <Button variant="secondary" onClick={props.onClear}>
        Limpar busca e filtros
      </Button>
    </div>
  );
}
