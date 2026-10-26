import { DownloadIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { errorsCsvUrl } from '../api';

/** CSV das linhas com erro e a coluna de motivo (RF19); a API neutraliza fórmulas (ADR-009). */
export function DownloadErrorsButton({ importId }: { importId: string }) {
  return (
    <Button asChild variant="secondary">
      <a href={errorsCsvUrl(importId)} download>
        <DownloadIcon aria-hidden="true" />
        Baixar linhas com erro (CSV)
      </a>
    </Button>
  );
}
