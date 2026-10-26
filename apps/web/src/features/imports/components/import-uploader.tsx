import { useNavigate } from '@tanstack/react-router';
import { DownloadIcon, FileUpIcon } from 'lucide-react';
import { useId, useState } from 'react';

import { apiErrorMessage } from '@/lib/form';
import { ApiError } from '@/lib/http';
import { cn } from '@/lib/utils';

import { IMPORT_MAX_BYTES, TEMPLATE_CSV_URL } from '../api';
import { useUploadImport } from '../hooks/use-imports';
import { type DuplicateFile, DuplicateFileDialog } from './duplicate-file-dialog';

const MESSAGES = {
  FILE_TOO_LARGE: 'O arquivo passa do limite de 5 MB.',
  UNSUPPORTED_FILE_TYPE: 'Envie um arquivo no formato CSV.',
  RATE_LIMITED: 'Muitos envios seguidos. Aguarde alguns minutos e tente novamente.',
};
const FALLBACK = 'Não foi possível enviar o arquivo. Tente novamente em instantes.';

/** Validação de UX (RN10); tipo e tamanho são conferidos de novo pela API. */
function validate(file: File): string | undefined {
  if (!file.name.toLowerCase().endsWith('.csv')) return 'Envie um arquivo no formato CSV (.csv).';
  if (file.size > IMPORT_MAX_BYTES) return 'O arquivo passa do limite de 5 MB.';
  return undefined;
}

/**
 * Envio do CSV (RF15, UC12): arrastar e soltar ou escolher pelo teclado (o `input file` continua
 * sendo o controle real, com o foco visível na área). Um 409 abre o `DuplicateFileDialog`.
 */
export function ImportUploader() {
  const upload = useUploadImport();
  const navigate = useNavigate();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const [error, setError] = useState<string>();
  const [dragging, setDragging] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateFile & { file: File }>();

  const send = (file: File, force = false) => {
    setError(undefined);
    upload.mutate(
      { file, force },
      {
        onError: (failure) => {
          const { importId, importedAt } = failure instanceof ApiError ? failure.extras : {};
          if (
            failure instanceof ApiError &&
            failure.code === 'IMPORT_ALREADY_EXISTS' &&
            typeof importId === 'string' &&
            typeof importedAt === 'string'
          ) {
            setDuplicate({ file, fileName: file.name, importId, importedAt });
            return;
          }
          setDuplicate(undefined);
          setError(apiErrorMessage(failure, MESSAGES, FALLBACK));
        },
      },
    );
  };

  const choose = (file: File | undefined) => {
    if (!file) return;
    const problem = validate(file);
    if (problem) setError(problem);
    else send(file);
  };

  return (
    <section aria-labelledby={`${inputId}-titulo`} className="grid gap-3">
      <h2 id={`${inputId}-titulo`} className="text-lg font-semibold">
        Nova importação
      </h2>
      {/* Arrastar é atalho de mouse; pelo teclado, o controle é o próprio input file */}
      <div
        role="presentation"
        className="grid"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          choose(event.dataTransfer.files[0]);
        }}
      >
        <input
          id={inputId}
          type="file"
          accept=".csv,text/csv"
          className="peer sr-only"
          disabled={upload.isPending}
          aria-describedby={[hintId, error ? errorId : ''].filter(Boolean).join(' ')}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
        <label
          htmlFor={inputId}
          className={cn(
            'grid cursor-pointer justify-items-center gap-2 rounded-md border-2 border-dashed border-input px-4 py-10 text-center hover:border-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring peer-disabled:cursor-progress',
            dragging && 'border-primary bg-surface',
          )}
        >
          <FileUpIcon aria-hidden="true" className="size-8 text-muted-foreground" />
          <span>
            Arraste o arquivo CSV até aqui ou{' '}
            <span className="text-primary underline underline-offset-2">escolha um arquivo</span>
          </span>
        </label>
      </div>
      <p id={hintId} className="text-sm text-muted-foreground">
        Até 5 MB, separado por vírgula ou ponto e vírgula, com as colunas nome, email, celular e
        telefone (opcional).
      </p>
      {upload.isPending && !duplicate && (
        <p role="status" className="text-sm">
          Enviando arquivo…
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <a
        href={TEMPLATE_CSV_URL}
        download
        className="inline-flex items-center gap-2 justify-self-start text-sm text-primary underline underline-offset-2"
      >
        <DownloadIcon aria-hidden="true" className="size-4" />
        Baixar CSV modelo
      </a>
      <DuplicateFileDialog
        duplicate={duplicate}
        pending={upload.isPending}
        onClose={() => {
          setDuplicate(undefined);
        }}
        onViewPrevious={(importId) => {
          void navigate({ to: '/importacoes/$id', params: { id: importId } });
        }}
        onImportAgain={() => {
          if (duplicate) send(duplicate.file, true);
        }}
      />
    </section>
  );
}
