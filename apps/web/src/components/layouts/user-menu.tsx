import type { User } from '@contatos/contracts';
import { LogOutIcon, MonitorSmartphoneIcon, UserIcon } from 'lucide-react';
import { useRef, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

/** Conta do usuário (RF03): sair desta sessão ou, após confirmação, de todas. */
export function UserMenu({ user, onLogout, onLogoutAll }: UserMenuProps) {
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button ref={triggerRef} variant="ghost" aria-label={`Conta de ${user.name}`}>
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
          <DropdownMenuItem
            onSelect={() => {
              setConfirmLogoutAll(true);
            }}
          >
            <MonitorSmartphoneIcon aria-hidden="true" />
            Sair de todas as sessões
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={confirmLogoutAll} onOpenChange={setConfirmLogoutAll}>
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            triggerRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Sair de todas as sessões?</AlertDialogTitle>
            <AlertDialogDescription>
              Você será desconectado deste e de todos os outros dispositivos e navegadores em que
              entrou com esta conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onLogoutAll}>Sair de todas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
