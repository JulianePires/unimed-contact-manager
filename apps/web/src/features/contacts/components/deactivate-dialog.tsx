import type { Contact } from '@contatos/contracts';
import { UserRoundMinusIcon } from 'lucide-react';
import { useRef, useState } from 'react';
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

import { useDeactivateContact } from '../hooks/use-contact-mutations';

interface DeactivateDialogProps {
  contact: Pick<Contact, 'id' | 'name'>;
  /** Após inativar, o gatilho some da tela; quem chama decide para onde o foco vai. */
  onDone: () => void;
}

/** RF11 (UC08): confirmação antes de inativar; cancelar devolve o foco ao gatilho. */
export function DeactivateDialog({ contact, onDone }: DeactivateDialogProps) {
  const [open, setOpen] = useState(false);
  const done = useRef(false);
  const deactivate = useDeactivateContact(contact.id);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="warning-outline">
          <UserRoundMinusIcon aria-hidden="true" />
          Inativar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (!done.current) return;
          event.preventDefault();
          onDone();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Inativar {contact.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            O contato sai da lista de ativos, mas o celular continua reservado para ele. Você pode
            reativá-lo quando quiser.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="warning-outline"
            disabled={deactivate.isPending}
            onClick={(event) => {
              event.preventDefault();
              deactivate.mutate(undefined, {
                onSuccess: () => {
                  done.current = true;
                  setOpen(false);
                },
                onError: () => toast.error('Não foi possível inativar o contato. Tente novamente.'),
              });
            }}
          >
            Inativar contato
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
