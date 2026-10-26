import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';
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

import { useDeleteImport } from '../hooks/use-imports';

/** RF23 (UC13 FA2): apaga a importação e os erros; os contatos criados continuam na agenda. */
export function DeleteImportButton({ importId }: { importId: string }) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteImport(importId);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="danger-outline">
          <Trash2Icon aria-hidden="true" />
          Excluir importação
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir esta importação?</AlertDialogTitle>
          <AlertDialogDescription>
            O registro e as linhas com erro serão apagados. Os contatos criados por ela continuam na
            agenda.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              remove.mutate(undefined, {
                onError: () =>
                  toast.error('Não foi possível excluir a importação. Tente novamente.'),
              });
            }}
          >
            Excluir importação
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
