import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import {
  deleteImport,
  importQueryOptions,
  importsQueryOptions,
  isActive,
  uploadImport,
} from '../api';

/** RF15 (UC12): 202 → acompanhamento da nova importação. */
export function useUploadImport() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({ file, force = false }: { file: File; force?: boolean }) =>
      uploadImport(file, { force }),
    onSuccess: async (created) => {
      queryClient.setQueryData(importQueryOptions(created.id).queryKey, created);
      void queryClient.invalidateQueries({ queryKey: ['imports'] });
      await navigate({ to: '/importacoes/$id', params: { id: created.id } });
    },
  });
}

/** RF23: sai do detalhe antes de limpar o cache, para a tela não buscar a importação removida. */
export function useDeleteImport(id: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => deleteImport(id),
    onSuccess: async () => {
      toast.success('Importação excluída.');
      await navigate({ to: '/importacoes' });
      queryClient.removeQueries({ queryKey: importQueryOptions(id).queryKey });
      queryClient.removeQueries({ queryKey: ['import-errors', id] });
      void queryClient.invalidateQueries({ queryKey: ['imports'] });
    },
  });
}

/** Há importação na fila ou em processamento? Alimenta o aviso na aba Importações. */
export function useHasActiveImport(): boolean {
  const { data } = useQuery(importsQueryOptions(1));
  return data?.data.some(isActive) ?? false;
}
