import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';

import { PublicLayout } from '@/components/layouts/public-layout';
import { LiveAnnouncer } from '@/components/live-announcer';
import { SkipLink } from '@/components/skip-link';
import { Toaster } from '@/components/ui/sonner';
import type { RouterContext } from '@/router';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
});

/** SkipLink, toasts e regiões aria-live comuns; cada layout define header, main e footer. */
function RootLayout() {
  return (
    <>
      <SkipLink targetId="conteudo" />
      <Outlet />
      <Toaster />
      <LiveAnnouncer />
    </>
  );
}

function NotFound() {
  return (
    <PublicLayout>
      <title>Página não encontrada · Agenda Unimed</title>
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <p className="mt-2">
        <Link to="/" className="text-primary underline">
          Voltar ao início
        </Link>
      </p>
    </PublicLayout>
  );
}
