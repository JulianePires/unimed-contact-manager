import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import { register, startSession } from '../api';

/** RF01 (UC01): a API já cria a sessão; a pessoa segue direto para a agenda. */
export function useRegister() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: register,
    onSuccess: async (user) => {
      startSession(queryClient, user);
      toast.success('Conta criada.');
      await navigate({ to: '/contatos' });
    },
  });
}
