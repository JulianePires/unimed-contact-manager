import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';

export interface DuplicateFile {
  fileName: string;
  importId: string;
  importedAt: string;
}

interface DuplicateFileDialogProps {
  duplicate: DuplicateFile | undefined;
  pending: boolean;
  onClose: () => void;
  onViewPrevious: (importId: string) => void;
  onImportAgain: () => void;
}

/**
 * 409 IMPORT_ALREADY_EXISTS (RF22, ADR-002): o mesmo arquivo já foi importado. Reenviar é seguro,
 * pois celulares que já estão na agenda são ignorados, mas só acontece após confirmação.
 */
export function DuplicateFileDialog({
  duplicate,
  pending,
  onClose,
  onViewPrevious,
  onImportAgain,
}: DuplicateFileDialogProps) {
  return (
    <Dialog
      open={duplicate !== undefined}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Este arquivo já foi importado</DialogTitle>
          <DialogDescription>
            {duplicate &&
              `“${duplicate.fileName}” foi importado em ${formatDateTime(duplicate.importedAt)}.`}{' '}
            Importar de novo não duplica contatos: celulares que já estão na agenda são ignorados.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              if (duplicate) onViewPrevious(duplicate.importId);
            }}
          >
            Ver importação anterior
          </Button>
          <Button disabled={pending} onClick={onImportAgain}>
            {pending ? 'Enviando…' : 'Importar novamente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
