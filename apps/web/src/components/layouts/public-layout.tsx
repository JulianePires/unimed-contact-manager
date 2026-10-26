import type { ReactNode } from 'react';

import { AppFooter } from './app-footer';
import { AppHeader, Brand } from './app-header';

/** Telas sem sessão (entrar, criar conta, não encontrado): marca, conteúdo e rodapé. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader>
        <Brand to="/entrar" />
      </AppHeader>
      <main
        id="conteudo"
        tabIndex={-1}
        className="mx-auto w-full max-w-md flex-1 px-4 py-10 focus:outline-none"
      >
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
