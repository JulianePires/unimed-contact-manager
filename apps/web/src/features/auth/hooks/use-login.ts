import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';

import { login, startSession } from '../api';

/** RF02: entra e volta à rota de origem (já validada como interna) ou à agenda. */
export function useLogin(redirectTo = '/contatos') {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: login,
    onSuccess: async (user) => {
      startSession(queryClient, user);
      await router.navigate({ href: redirectTo });
    },
  });
}
