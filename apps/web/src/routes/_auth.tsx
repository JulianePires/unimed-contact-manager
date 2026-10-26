import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router';

import { AuthenticatedLayout } from '@/components/layouts/authenticated-layout';
import { PublicLayout } from '@/components/layouts/public-layout';
import { Button } from '@/components/ui/button';
import { meQueryOptions } from '@/features/auth/api';
import { useLogout } from '@/features/auth/hooks/use-logout';
import { useHasActiveImport } from '@/features/imports/hooks/use-imports';
import { ApiError } from '@/lib/http';

/** Área autenticada (RF04): sem sessão → /entrar?redirect=<rota pedida> (docs/06 §6.1). */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.query(meQueryOptions);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        redirect({ to: '/entrar', search: { redirect: location.href }, throw: true });
      }
      throw error;
    }
  },
  component: AuthenticatedRoute,
  errorComponent: AuthenticatedError,
});

/** Falha inesperada ao carregar a área (ex.: API indisponível), sem detalhes técnicos na tela. */
function AuthenticatedError() {
  const router = useRouter();
  return (
    <PublicLayout>
      <title>Algo deu errado · Agenda Unimed</title>
      <h1 className="text-2xl font-semibold">Algo deu errado</h1>
      <p className="mt-2 text-muted-foreground">
        Não foi possível carregar esta página. Tente novamente em instantes.
      </p>
      <Button className="mt-6" onClick={() => void router.invalidate()}>
        Tentar novamente
      </Button>
    </PublicLayout>
  );
}

function AuthenticatedRoute() {
  const { data: user } = useSuspenseQuery(meQueryOptions);
  const { logout, logoutAll } = useLogout();
  const importsInProgress = useHasActiveImport();

  return (
    <AuthenticatedLayout
      user={user}
      importsInProgress={importsInProgress}
      onLogout={() => void logout()}
      onLogoutAll={() => void logoutAll()}
    >
      <Outlet />
    </AuthenticatedLayout>
  );
}
