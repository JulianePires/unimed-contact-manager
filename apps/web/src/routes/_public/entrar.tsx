import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import { internalPath } from '@/lib/http';

/** `redirect` só aceita caminhos internos (docs/06 §6.1); qualquer outro valor é descartado. */
const searchSchema = z.object({
  redirect: z.unknown().transform(internalPath).optional(),
});

export const Route = createFileRoute('/_public/entrar')({
  validateSearch: searchSchema,
  component: LoginPage,
});

function LoginPage() {
  return (
    <>
      <title>Entrar · Agenda Unimed</title>
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <p className="mt-2 text-muted-foreground">Acesse sua agenda de contatos.</p>
    </>
  );
}
