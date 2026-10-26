import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { ApiError } from '@/lib/http';

import { logout, logoutAll } from '../api';

/**
 * RF03 (UC03). Ao sair, nenhum dado fica em memória (ADR-009 §4). Sessão já expirada (401) também
 * conta como saída; outra falha mantém a sessão e avisa, pois o cookie ainda vale no servidor.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const leave = (end: () => Promise<void>) => async () => {
    try {
      await end();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        toast.error('Não foi possível sair. Tente novamente.');
        return;
      }
    }
    queryClient.clear();
    await navigate({ to: '/entrar' });
  };

  return { logout: leave(logout), logoutAll: leave(logoutAll) };
}
