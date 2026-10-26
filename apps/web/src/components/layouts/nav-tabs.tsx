import { Link } from '@tanstack/react-router';

const TABS = [
  { to: '/contatos', label: 'Contatos' },
  { to: '/importacoes', label: 'Importações' },
] as const;

/** Navegação principal; a aba da rota atual recebe `aria-current="page"`. */
export function NavTabs() {
  return (
    <nav aria-label="Principal">
      <ul className="flex gap-1">
        {TABS.map(({ to, label }) => (
          <li key={to}>
            <Link
              to={to}
              className="inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-surface-raised hover:text-foreground aria-[current=page]:bg-surface-raised aria-[current=page]:text-foreground"
              activeProps={{ 'aria-current': 'page' }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
