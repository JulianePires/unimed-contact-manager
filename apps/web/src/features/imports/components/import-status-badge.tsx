import type { ImportStatus } from '@contatos/contracts';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleXIcon,
  ClockIcon,
  LoaderCircleIcon,
  type LucideIcon,
} from 'lucide-react';

import { Badge, type BadgeProps } from '@/components/ui/badge';

const STATUS: Record<
  ImportStatus,
  { label: string; color: NonNullable<BadgeProps['color']>; icon: LucideIcon }
> = {
  PENDING: { label: 'Na fila', color: 'zinc', icon: ClockIcon },
  PROCESSING: { label: 'Processando', color: 'violet', icon: LoaderCircleIcon },
  COMPLETED: { label: 'Concluída', color: 'green', icon: CircleCheckIcon },
  COMPLETED_WITH_ERRORS: { label: 'Concluída com erros', color: 'amber', icon: CircleAlertIcon },
  FAILED: { label: 'Falhou', color: 'rose', icon: CircleXIcon },
};

export function importStatusLabel(status: ImportStatus): string {
  return STATUS[status].label;
}

/** Status com texto e ícone, não só cor (docs/06 §6.7). */
export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  const { label, color, icon: Icon } = STATUS[status];
  return (
    <Badge color={color}>
      <Icon
        aria-hidden="true"
        className={status === 'PROCESSING' ? 'motion-safe:animate-spin' : undefined}
      />
      {label}
    </Badge>
  );
}
