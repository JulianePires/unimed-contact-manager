import { UserRoundCheckIcon } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';

import { useReactivateContact } from '../hooks/use-contact-mutations';

interface ReactivateButtonProps {
  contactId: string;
  /** Após reativar, o botão some da tela; quem chama decide para onde o foco vai. */
  onDone: () => void;
}

/** RF12 (UC09): reativar não pede confirmação, pois é reversível e idempotente. */
export function ReactivateButton({ contactId, onDone }: ReactivateButtonProps) {
  const reactivate = useReactivateContact(contactId);

  return (
    <Button
      disabled={reactivate.isPending}
      onClick={() => {
        reactivate.mutate(undefined, {
          onSuccess: () => {
            toast.success('Contato reativado.');
            onDone();
          },
          onError: () => toast.error('Não foi possível reativar o contato. Tente novamente.'),
        });
      }}
    >
      <UserRoundCheckIcon aria-hidden="true" />
      Reativar
    </Button>
  );
}
