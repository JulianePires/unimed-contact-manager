import { Link } from '@tanstack/react-router';
import { LoaderCircleIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

interface NavTabsProps {
  /** Há importação na fila ou em processamento: a aba avisa enquanto durar. */
  importsInProgress?: boolean;
}

/** Navegação principal; a aba da rota atual recebe `aria-current="page"`. */
export function NavTabs({ importsInProgress = false }: NavTabsProps) {
  const tabs = [
    { to: '/contatos', label: 'Contatos', busy: false },
    { to: '/importacoes', label: 'Importações', busy: importsInProgress },
  ] as const;

  return (
    <nav aria-label="Principal">
      <ul className="flex gap-1">
        {tabs.map(({ to, label, busy }) => (
          <li key={to}>
            <Link
              to={to}
              className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-surface-raised hover:text-foreground aria-[current=page]:bg-surface-raised aria-[current=page]:text-foreground"
              activeProps={{ 'aria-current': 'page' }}
            >
              {label}
              {busy && (
                <Badge color="violet">
                  <LoaderCircleIcon aria-hidden="true" className="motion-safe:animate-spin" />
                  processando
                </Badge>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
