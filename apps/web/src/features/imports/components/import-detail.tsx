import { isTerminalImportStatus } from '@contatos/contracts';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon, CircleXIcon } from 'lucide-react';
import { Suspense } from 'react';

import { formatDateTime } from '@/lib/format';

import { importQueryOptions } from '../api';
import { DeleteImportButton } from './delete-import-button';
import { DownloadErrorsButton } from './download-errors-button';
import { ImportErrorsTable } from './import-errors-table';
import { ImportProgress } from './import-progress';
import { ImportStatusBadge } from './import-status-badge';

interface ImportDetailProps {
  importId: string;
  errorsPage: number;
  onErrorsPageChange: (page: number) => void;
}

/** Progresso, resumo e erros de uma importação (UC13/UC14); o polling para no estado terminal. */
export function ImportDetail({ importId, errorsPage, onErrorsPageChange }: ImportDetailProps) {
  const { data: item } = useSuspenseQuery(importQueryOptions(importId));
  const finished = isTerminalImportStatus(item.status);

  return (
    <div className="grid gap-6">
      <Link
        to="/importacoes"
        className="inline-flex items-center gap-1 justify-self-start text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-4" />
        Importações
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold break-all">{item.fileName}</h1>
            <ImportStatusBadge status={item.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Enviada em {formatDateTime(item.createdAt)}
            {item.finishedAt && ` · finalizada em ${formatDateTime(item.finishedAt)}`}
          </p>
        </div>
        {finished && <DeleteImportButton importId={item.id} />}
      </div>

      {item.status === 'FAILED' && (
        <div className="flex gap-3 rounded-md border border-danger-border p-4">
          <CircleXIcon aria-hidden="true" className="size-5 shrink-0 text-danger" />
          <div className="grid gap-1">
            <h2 className="font-semibold text-danger">A importação falhou</h2>
            <p className="text-sm text-muted-foreground">
              {item.failureReason ?? 'O arquivo não pôde ser processado.'} Corrija o arquivo e envie
              novamente.
            </p>
          </div>
        </div>
      )}

      <ImportProgress item={item} />

      {finished && item.failedCount > 0 && (
        <section aria-labelledby="linhas-com-erro" className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 id="linhas-com-erro" className="text-lg font-semibold">
              Linhas com erro
            </h2>
            <DownloadErrorsButton importId={item.id} />
          </div>
          <Suspense fallback={<p className="text-muted-foreground">Carregando linhas com erro…</p>}>
            <ImportErrorsTable
              importId={item.id}
              page={errorsPage}
              onPageChange={onErrorsPageChange}
            />
          </Suspense>
        </section>
      )}
    </div>
  );
}
