import { createFileRoute } from '@tanstack/react-router';

import { ContactForm, EMPTY_CONTACT } from '@/features/contacts/components/contact-form';
import { useCreateContact } from '@/features/contacts/hooks/use-contact-mutations';

export const Route = createFileRoute('/_auth/contatos/novo')({
  component: NewContactPage,
});

function NewContactPage() {
  const create = useCreateContact();

  return (
    <>
      <title>Novo contato · Agenda Unimed</title>
      <div className="grid max-w-xl gap-6">
        <h1 className="text-2xl font-semibold">Novo contato</h1>
        <ContactForm
          defaultValues={EMPTY_CONTACT}
          submitLabel="Cadastrar contato"
          onSubmit={(values) => create.mutateAsync(values)}
        />
      </div>
    </>
  );
}
