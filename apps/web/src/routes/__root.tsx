import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';

import { SkipLink } from '../components/skip-link';
import type { RouterContext } from '../router';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <>
      <SkipLink targetId="conteudo" />
      <main id="conteudo" tabIndex={-1} className="mx-auto max-w-5xl p-4 focus:outline-none">
        <Outlet />
      </main>
    </>
  );
}

function NotFound() {
  return (
    <>
      <title>Página não encontrada · Agenda Unimed</title>
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="mt-2">
        <Link to="/" className="underline">
          Voltar ao início
        </Link>
      </p>
    </>
  );
}
