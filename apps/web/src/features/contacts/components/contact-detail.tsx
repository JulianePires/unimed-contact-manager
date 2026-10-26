import type { Contact } from '@contatos/contracts';
import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon, PencilIcon } from 'lucide-react';
import { type ReactNode, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { formatDateTime, formatPhoneForDisplay } from '@/lib/format';

import { AnonymizeDialog } from './anonymize-dialog';
import { DeactivateDialog } from './deactivate-dialog';
import { FavoriteToggle } from './favorite-toggle';
import { ReactivateButton } from './reactivate-button';
import { StatusBadge } from './status-badge';

/**
 * Detalhe do contato (UC06). Ativo: editar e inativar. Inativo: reativar e eliminar os dados
 * (só inativos, ADR-009). Quando uma ação troca os botões, o foco vai para o título.
 */
export function ContactDetail({ contact }: { contact: Contact }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = () => {
    headingRef.current?.focus();
  };
  const active = contact.status === 'active';

  return (
    <div className="grid gap-6">
      <Link
        to="/contatos"
        className="inline-flex items-center gap-1 justify-self-start text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        Contatos
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
          {contact.name}
        </h1>
        <StatusBadge status={contact.status} />
        <FavoriteToggle contact={contact} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="secondary">
          <Link to="/contatos/$id/editar" params={{ id: contact.id }}>
            <PencilIcon aria-hidden="true" />
            Editar
          </Link>
        </Button>
        {active ? (
          <DeactivateDialog contact={contact} onDone={focusHeading} />
        ) : (
          <>
            <ReactivateButton contactId={contact.id} onDone={focusHeading} />
            <AnonymizeDialog contact={contact} />
          </>
        )}
      </div>
      <dl className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-[max-content_1fr] sm:gap-x-8">
        <Item label="E-mail">
          <a href={`mailto:${contact.email}`} className="underline-offset-2 hover:underline">
            {contact.email}
          </a>
        </Item>
        <Item label="Celular">{contact.mobileFormatted}</Item>
        <Item label="Telefone">{formatPhoneForDisplay(contact.phone)}</Item>
        <Item label="Cadastrado em">{formatDateTime(contact.createdAt)}</Item>
        <Item label="Atualizado em">{formatDateTime(contact.updatedAt)}</Item>
        {contact.deactivatedAt && (
          <Item label="Inativado em">{formatDateTime(contact.deactivatedAt)}</Item>
        )}
      </dl>
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 sm:contents">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
