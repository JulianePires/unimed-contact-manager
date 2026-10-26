import type { User } from '@contatos/contracts';
import { LogOutIcon, MonitorSmartphoneIcon, UserIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface UserMenuProps {
  user: User;
  onLogout: () => void;
  onLogoutAll: () => void;
}

/** Conta do usuário: sair desta sessão ou de todos os dispositivos (RF03). */
export function UserMenu({ user, onLogout, onLogoutAll }: UserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" aria-label={`Conta de ${user.name}`}>
          <UserIcon aria-hidden="true" />
          <span className="max-w-40 truncate">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLogout}>
          <LogOutIcon aria-hidden="true" />
          Sair
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogoutAll}>
          <MonitorSmartphoneIcon aria-hidden="true" />
          Sair de todos os dispositivos
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
