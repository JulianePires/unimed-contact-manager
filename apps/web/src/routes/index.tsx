import { createFileRoute, redirect } from '@tanstack/react-router';

/** A agenda é a tela inicial; sem sessão, o guard da área autenticada leva ao login. */
export const Route = createFileRoute('/')({
  beforeLoad: () => {
    redirect({ to: '/contatos', throw: true });
  },
});
