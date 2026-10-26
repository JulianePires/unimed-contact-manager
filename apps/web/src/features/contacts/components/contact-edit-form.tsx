import type { Contact } from '@contatos/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { HistoryIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { contactQueryOptions } from '../api';
import { useUpdateContact } from '../hooks/use-contact-mutations';
import { ContactForm, toFormValues } from './contact-form';

/**
 * Edição com controle de concorrência (RN07, ADR-004): envia a versão lida em `If-Match`. No 412,
 * o texto digitado fica no formulário até a pessoa pedir a versão atual, que substitui os campos.
 */
export function ContactEditForm({ contact }: { contact: Contact }) {
  const queryClient = useQueryClient();
  const update = useUpdateContact();
  const [base, setBase] = useState(contact);
  const [revision, setRevision] = useState(0);
  const [modifiedElsewhere, setModifiedElsewhere] = useState(false);

  const loadCurrentVersion = async () => {
    try {
      const current = await queryClient.query({ ...contactQueryOptions(base.id), staleTime: 0 });
      setBase(current);
      setRevision((value) => value + 1);
      setModifiedElsewhere(false);
    } catch {
      toast.error('Não foi possível carregar a versão atual. Tente novamente.');
    }
  };

  return (
    <ContactForm
      key={revision}
      defaultValues={toFormValues(base)}
      submitLabel="Salvar alterações"
      onSubmit={(values) => update.mutateAsync({ contact: base, input: values })}
      onApiError={(error) => {
        if (error.code !== 'CONTACT_MODIFIED') return false;
        setModifiedElsewhere(true);
        return true;
      }}
      notice={
        modifiedElsewhere && (
          <ModifiedElsewhereAlert
            onLoadCurrentVersion={() => {
              void loadCurrentVersion();
            }}
          />
        )
      }
    />
  );
}

function ModifiedElsewhereAlert({ onLoadCurrentVersion }: { onLoadCurrentVersion: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

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
        <HistoryIcon aria-hidden="true" className="size-4" />
        Este contato foi alterado em outra sessão
      </h2>
      <p className="text-sm text-muted-foreground">
        Suas alterações não foram salvas e continuam no formulário. Copie o que precisar: carregar a
        versão atual substitui o que você digitou.
      </p>
      <Button
        type="button"
        variant="warning-outline"
        className="justify-self-start"
        onClick={onLoadCurrentVersion}
      >
        Carregar versão atual
      </Button>
    </div>
  );
}
