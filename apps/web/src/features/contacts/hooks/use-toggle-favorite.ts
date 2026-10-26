import { useMutation, useQueryClient } from '@tanstack/react-query';

import { setFavorite, setFavoriteInCache } from '../api';

interface ToggleFavorite {
  id: string;
  favorite: boolean;
}

/** RF13. Após a resposta, as listas e o detalhe são revalidados (docs/06 §6.3). */
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, favorite }: ToggleFavorite) => setFavorite(id, favorite),
    onSuccess: (_, { id, favorite }) => {
      setFavoriteInCache(queryClient, id, favorite);
    },
    onSettled: (_, __, { id }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['contacts'] }),
        queryClient.invalidateQueries({ queryKey: ['contact', id] }),
      ]),
  });
}
