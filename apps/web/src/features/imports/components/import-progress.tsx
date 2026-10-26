import { type Import, isTerminalImportStatus } from '@contatos/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useId, useRef } from 'react';

import { announce } from '@/lib/a11y/announce';
import { formatCount, pluralize } from '@/lib/format';

const QUARTERS = [75, 50, 25] as const;

function percent({ processedRows, totalRows }: Import): number {
  return totalRows > 0 ? Math.floor((processedRows / totalRows) * 100) : 0;
}

/** Marcos anunciados: mudança de status e cada quarto do processamento, não cada atualização. */
function milestoneOf(item: Import): string {
  if (item.status !== 'PROCESSING') return item.status;
  const quarter = QUARTERS.find((value) => percent(item) >= value);
  return quarter ? `PROCESSING_${String(quarter)}` : item.status;
}

function summary({ createdCount, skippedCount, failedCount }: Import): string {
  return [
    pluralize(createdCount, 'contato criado', 'contatos criados'),
    pluralize(skippedCount, 'ignorado', 'ignorados'),
    `${formatCount(failedCount)} com erro`,
  ].join(', ');
}

function milestoneMessage(item: Import): string {
  switch (item.status) {
    case 'PENDING':
      return 'Importação na fila.';
    case 'PROCESSING':
      return percent(item) >= 25
        ? `Importação em ${String(percent(item))}%.`
        : 'Importação em processamento.';
    case 'COMPLETED':
      return `Importação concluída: ${summary(item)}.`;
    case 'COMPLETED_WITH_ERRORS':
      return `Importação concluída com erros: ${summary(item)}.`;
    case 'FAILED':
      return 'A importação falhou.';
  }
}

/**
 * Acompanhamento (RF17, UC13): barra de progresso e contadores atualizados pelo polling. Os marcos
 * vão para o `aria-live` via `useEffectEvent`, sem reiniciar o efeito a cada atualização (docs/06
 * §6.5). Ao terminar, a agenda e o histórico são revalidados (docs/06 §6.3).
 */
export function ImportProgress({ item }: { item: Import }) {
  const queryClient = useQueryClient();
  const labelId = useId();
  const milestone = milestoneOf(item);
  const announced = useRef(milestone);

  const onMilestone = useEffectEvent(() => {
    announce(milestoneMessage(item), item.status === 'FAILED' ? 'assertive' : 'polite');
    if (isTerminalImportStatus(item.status)) {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
      void queryClient.invalidateQueries({ queryKey: ['imports'] });
      void queryClient.invalidateQueries({ queryKey: ['import-errors', item.id] });
    }
  });

  useEffect(() => {
    if (announced.current === milestone) return;
    announced.current = milestone;
    onMilestone();
  }, [milestone]);

  const determinate = item.totalRows > 0;

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between gap-4 text-sm">
          <span id={labelId} className="font-medium">
            Progresso
          </span>
          <span className="text-muted-foreground tabular-nums">
            {determinate
              ? `${formatCount(item.processedRows)} de ${formatCount(item.totalRows)} linhas`
              : 'Aguardando o início do processamento'}
          </span>
        </div>
        <div
          role="progressbar"
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={determinate ? item.totalRows : undefined}
          aria-valuenow={determinate ? item.processedRows : undefined}
          aria-valuetext={
            determinate
              ? `${formatCount(item.processedRows)} de ${formatCount(item.totalRows)} linhas`
              : 'Aguardando o início do processamento'
          }
          className="h-2 overflow-hidden rounded-full bg-surface-raised"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
            style={{ width: `${String(percent(item))}%` }}
          />
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-4 rounded-md border border-border p-4 text-center">
        <Counter label="Criados" value={item.createdCount} />
        <Counter label="Ignorados" value={item.skippedCount} />
        <Counter label="Com erro" value={item.failedCount} />
      </dl>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{formatCount(value)}</dd>
    </div>
  );
}
