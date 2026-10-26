import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';

import { loadContact } from '@/features/contacts/api';
import { ContactEditForm } from '@/features/contacts/components/contact-edit-form';
import { ContactNotFound } from '@/features/contacts/components/contact-not-found';

/** A edição parte sempre da versão atual do servidor, para o `If-Match` não nascer velho. */
export const Route = createFileRoute('/_auth/contatos/$id_/editar')({
  loader: ({ context, params }) => loadContact(context.queryClient, params.id, { fresh: true }),
  component: EditContactPage,
  notFoundComponent: ContactNotFound,
});

function EditContactPage() {
  const contact = Route.useLoaderData();

  return (
    <>
      <title>Editar contato · Agenda Unimed</title>
      <div className="grid max-w-xl gap-6">
        <Link
          to="/contatos/$id"
          params={{ id: contact.id }}
          className="inline-flex items-center gap-1 justify-self-start text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          <ArrowLeftIcon aria-hidden="true" className="size-4" />
          Voltar ao contato
        </Link>
        <h1 className="text-2xl font-semibold">Editar contato</h1>
        <ContactEditForm contact={contact} />
      </div>
    </>
  );
}
