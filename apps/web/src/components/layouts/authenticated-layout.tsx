import type { ReactNode } from 'react';

import { AppFooter } from './app-footer';
import { AppHeader, Brand } from './app-header';
import { NavTabs } from './nav-tabs';
import { UserMenu, type UserMenuProps } from './user-menu';

/** Área autenticada: cabeçalho com marca, abas e conta; conteúdo da rota e rodapé. */
export function AuthenticatedLayout({
  children,
  ...account
}: UserMenuProps & { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Brand to="/contatos" />
          <NavTabs />
        </div>
        <UserMenu {...account} />
      </AppHeader>
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 focus:outline-none"
      >
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
