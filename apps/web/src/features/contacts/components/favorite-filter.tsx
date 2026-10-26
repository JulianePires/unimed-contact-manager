import { StarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FavoriteFilterProps {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}

/** Filtro "só favoritos" (RF08) como botão alternável: o estado vem de `aria-pressed`. */
export function FavoriteFilter({ pressed, onPressedChange }: FavoriteFilterProps) {
  return (
    <Button
      variant="secondary"
      aria-pressed={pressed}
      className="aria-pressed:border-warning"
      onClick={() => {
        onPressedChange(!pressed);
      }}
    >
      <StarIcon
        aria-hidden="true"
        className={cn(pressed ? 'fill-warning text-warning' : 'text-muted-foreground')}
      />
      Só favoritos
    </Button>
  );
}
