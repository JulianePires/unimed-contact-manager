import type { Contact } from '@contatos/contracts';
import { StarIcon } from 'lucide-react';
import { startTransition, useOptimistic } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useToggleFavorite } from '../hooks/use-toggle-favorite';

/**
 * Favorito otimista (RF13, docs/06 §6.5): `aria-pressed` muda na hora; se a API falhar, o
 * `useOptimistic` volta ao valor real ao fim da transição e o erro é avisado.
 */
export function FavoriteToggle({
  contact,
}: {
  contact: Pick<Contact, 'id' | 'name' | 'isFavorite'>;
}) {
  const toggle = useToggleFavorite();
  const [isFavorite, setOptimisticFavorite] = useOptimistic(contact.isFavorite);

  const onClick = () => {
    const favorite = !isFavorite;
    startTransition(async () => {
      setOptimisticFavorite(favorite);
      try {
        await toggle.mutateAsync({ id: contact.id, favorite });
      } catch {
        toast.error(
          `Não foi possível ${favorite ? 'favoritar' : 'desfavoritar'} ${contact.name}. Tente novamente.`,
        );
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Favoritar ${contact.name}`}
      aria-pressed={isFavorite}
      onClick={onClick}
    >
      <StarIcon
        aria-hidden="true"
        className={cn(isFavorite ? 'fill-warning text-warning' : 'text-muted-foreground')}
      />
    </Button>
  );
}
