import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { ClockAlertIcon } from 'lucide-react';
import { z } from 'zod';

import { LoginForm } from '@/features/auth/components/login-form';
import { currentUser } from '@/features/auth/api';
import { internalPath, SESSION_EXPIRED } from '@/lib/http';

/** `redirect` só aceita caminhos internos (docs/06 §6.1); qualquer outro valor é descartado. */
const searchSchema = z.object({
  redirect: z.unknown().transform(internalPath).optional(),
  motivo: z.literal(SESSION_EXPIRED).optional().catch(undefined),
});

export const Route = createFileRoute('/_public/entrar')({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, search }) => {
    if (await currentUser(context.queryClient)) {
      redirect({ href: search.redirect ?? '/contatos', throw: true });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { redirect: redirectTo, motivo } = Route.useSearch();
  const expired = motivo === SESSION_EXPIRED;

  return (
    <>
      <title>{expired ? 'Sessão expirada · Agenda Unimed' : 'Entrar · Agenda Unimed'}</title>
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <p className="mt-2 text-muted-foreground">Acesse sua agenda de contatos.</p>
      {expired && (
        <div className="mt-6 flex gap-3 rounded-md border border-warning p-4 text-sm">
          <ClockAlertIcon aria-hidden="true" className="size-5 shrink-0 text-warning" />
          <div>
            <h2 className="font-semibold text-warning">Sua sessão expirou</h2>
            <p className="mt-1 text-muted-foreground">
              Por segurança, a sessão termina após um período sem uso. Entre novamente para
              continuar de onde parou.
            </p>
          </div>
        </div>
      )}
      <div className="mt-6">
        <LoginForm redirectTo={redirectTo} />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Ainda não tem conta?{' '}
        <Link to="/criar-conta" className="text-primary underline underline-offset-2">
          Criar conta
        </Link>
      </p>
    </>
  );
}
