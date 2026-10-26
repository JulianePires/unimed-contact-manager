import { Link } from '@tanstack/react-router';
import { BookUserIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Marca da aplicação; leva à agenda (área autenticada) ou ao login (área pública). */
export function Brand({ to }: { to: '/contatos' | '/entrar' }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 text-base font-semibold text-foreground"
    >
      <BookUserIcon aria-hidden="true" className="size-5 text-primary" />
      Agenda Unimed
    </Link>
  );
}

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        {children}
      </div>
    </header>
  );
}
