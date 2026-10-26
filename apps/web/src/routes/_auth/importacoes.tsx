import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/importacoes')({
  component: ImportsPage,
});

function ImportsPage() {
  return (
    <>
      <title>Importações · Agenda Unimed</title>
      <h1 className="text-2xl font-semibold">Importações</h1>
    </>
  );
}
