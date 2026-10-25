import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <>
      <title>Gerenciador de Contatos</title>
      <h1 className="text-2xl font-semibold">Gerenciador de Contatos</h1>
    </>
  );
}
