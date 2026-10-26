import { createFileRoute, Link } from '@tanstack/react-router';

import { PrivacySummary } from '@/features/auth/components/privacy-notice';
import { RegisterForm } from '@/features/auth/components/register-form';

export const Route = createFileRoute('/_public/criar-conta')({
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <>
      <title>Criar conta · Agenda Unimed</title>
      <h1 className="text-2xl font-semibold">Criar conta</h1>
      <p className="mt-2 text-muted-foreground">Organize seus contatos em um só lugar.</p>
      <div className="mt-6">
        <RegisterForm />
      </div>
      <div className="mt-6">
        <PrivacySummary />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        Já tem conta?{' '}
        <Link to="/entrar" className="text-primary underline underline-offset-2">
          Entrar
        </Link>
      </p>
    </>
  );
}
