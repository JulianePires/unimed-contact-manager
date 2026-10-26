import type { ContactStatus } from '@contatos/contracts';
import { CircleCheckIcon, CircleMinusIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';

/** Status com texto e ícone, não só cor (docs/06 §6.7). */
export function StatusBadge({ status }: { status: ContactStatus }) {
  return status === 'active' ? (
    <Badge color="green">
      <CircleCheckIcon aria-hidden="true" />
      Ativo
    </Badge>
  ) : (
    <Badge color="zinc">
      <CircleMinusIcon aria-hidden="true" />
      Inativo
    </Badge>
  );
}
