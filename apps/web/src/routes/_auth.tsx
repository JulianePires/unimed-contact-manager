import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, Outlet, redirect, useNavigate, useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';

import { AuthenticatedLayout } from '@/components/layouts/authenticated-layout';
import { PublicLayout } from '@/components/layouts/public-layout';
import { Button } from '@/components/ui/button';
import { logout, logoutAll, meQueryOptions } from '@/features/auth/api';
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
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  /**
   * Ao sair, nenhum dado fica em memória (ADR-009 §4). Sessão já expirada (401) também conta como
   * saída; outra falha mantém a sessão e avisa, pois o cookie ainda vale no servidor.
   */
  const leave = (end: () => Promise<void>) => async () => {
    try {
      await end();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        toast.error('Não foi possível sair. Tente novamente.');
        return;
      }
    }
    queryClient.clear();
    await navigate({ to: '/entrar' });
  };

  return (
    <AuthenticatedLayout
      user={user}
      onLogout={() => void leave(logout)()}
      onLogoutAll={() => void leave(logoutAll)()}
    >
      <Outlet />
    </AuthenticatedLayout>
  );
}
