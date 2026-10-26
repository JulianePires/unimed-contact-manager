import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

import { contactQueryOptions, loadContact } from '@/features/contacts/api';
import { ContactDetail } from '@/features/contacts/components/contact-detail';
import { ContactNotFound } from '@/features/contacts/components/contact-not-found';

export const Route = createFileRoute('/_auth/contatos/$id')({
  loader: ({ context, params }) => loadContact(context.queryClient, params.id),
  component: ContactDetailPage,
  notFoundComponent: ContactNotFound,
});

function ContactDetailPage() {
  const { id } = Route.useParams();
  const { data: contact } = useSuspenseQuery(contactQueryOptions(id));

  return (
    <>
      {/* Sem o nome no título: títulos ficam no histórico do navegador (ADR-009) */}
      <title>Contato · Agenda Unimed</title>
      <ContactDetail contact={contact} />
    </>
  );
}
