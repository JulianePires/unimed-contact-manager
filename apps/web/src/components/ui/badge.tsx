import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/** Cor reforça o texto do badge, nunca o substitui (status com texto e ícone, docs/06 §6.7). */
export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      color: {
        green: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
        violet: 'border-violet-500/40 bg-violet-500/15 text-violet-300',
        amber: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
        rose: 'border-rose-500/40 bg-rose-500/15 text-rose-300',
        zinc: 'border-zinc-500/40 bg-zinc-500/15 text-zinc-300',
      },
    },
    defaultVariants: { color: 'zinc' },
  },
);

export type BadgeProps = Omit<ComponentProps<'span'>, 'color'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, color, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ color }), className)} {...props} />;
}
