import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { UserRoundXIcon } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { contactQueryOptions } from '../api';
import { useReactivateContact } from '../hooks/use-contact-mutations';

interface InactiveConflictAlertProps {
  contactId: string;
  onUseAnotherNumber: () => void;
}

/**
 * 409 MOBILE_BELONGS_TO_INACTIVE_CONTACT (RN04, ADR-001): o número segue reservado ao contato
 * inativo. Oferece reativá-lo (o formulário é descartado) ou voltar ao campo para trocar o número.
 */
export function InactiveConflictAlert({
  contactId,
  onUseAnotherNumber,
}: InactiveConflictAlertProps) {
  const { data: contact } = useQuery(contactQueryOptions(contactId));
  const reactivate = useReactivateContact(contactId);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const name = contact?.name;

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      aria-labelledby={titleId}
      className="grid gap-3 rounded-md border border-warning p-4"
    >
      <h2 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-warning">
        <UserRoundXIcon aria-hidden="true" className="size-4" />
        Este celular pertence a um contato inativo
      </h2>
      <p className="text-sm text-muted-foreground">
        {name ? `${name} está inativo` : 'O contato está inativo'} e continua com este número. Você
        pode reativá-lo ou informar outro celular.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="warning-outline"
          disabled={reactivate.isPending}
          onClick={() => {
            reactivate.mutate(undefined, {
              onSuccess: (reactivated) => {
                toast.success(`${reactivated.name} foi reativado.`);
                void navigate({ to: '/contatos/$id', params: { id: contactId } });
              },
              onError: () => toast.error('Não foi possível reativar o contato. Tente novamente.'),
            });
          }}
        >
          {name ? `Reativar ${name}` : 'Reativar contato'}
        </Button>
        <Button type="button" variant="secondary" onClick={onUseAnotherNumber}>
          Usar outro número
        </Button>
      </div>
    </div>
  );
}
