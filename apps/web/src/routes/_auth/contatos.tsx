import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_auth/contatos')({
  component: ContactsPage,
});

function ContactsPage() {
  return (
    <>
      <title>Contatos · Agenda Unimed</title>
      <h1 className="text-2xl font-semibold">Contatos</h1>
    </>
  );
}
