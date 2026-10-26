import type { Contact } from '@contatos/contracts';
import { Trash2Icon } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/http';

import { useAnonymizeContact } from '../hooks/use-contact-mutations';

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

/**
 * RF14 (UC11, ADR-009): eliminação irreversível, só para inativos. A confirmação exige digitar o
 * nome do contato, evitando que um clique distraído apague os dados.
 */
export function AnonymizeDialog({ contact }: { contact: Pick<Contact, 'id' | 'name'> }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const inputId = useId();
  const anonymize = useAnonymizeContact(contact);
  const confirmed = normalize(confirmation) === normalize(contact.name);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmation('');
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="danger-outline">
          <Trash2Icon aria-hidden="true" />
          Excluir dados definitivamente
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir os dados de {contact.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. Nome, e-mail, celular e telefone serão apagados, e o
            celular ficará livre para um novo cadastro.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <Label htmlFor={inputId}>Digite o nome do contato para confirmar</Label>
          <Input
            id={inputId}
            autoComplete="off"
            value={confirmation}
            onChange={(event) => {
              setConfirmation(event.target.value);
            }}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="danger"
            disabled={!confirmed || anonymize.isPending}
            onClick={(event) => {
              event.preventDefault();
              anonymize.mutate(undefined, {
                onError: (error) => {
                  toast.error(
                    error instanceof ApiError && error.code === 'CONTACT_MUST_BE_INACTIVE'
                      ? 'Inative o contato antes de excluir os dados.'
                      : 'Não foi possível excluir os dados. Tente novamente.',
                  );
                },
              });
            }}
          >
            Excluir definitivamente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
