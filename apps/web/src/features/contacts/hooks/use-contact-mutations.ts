import type { Contact, CreateContactInput, UpdateContactInput } from '@contatos/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';

import {
  anonymizeContact,
  contactQueryOptions,
  createContact,
  deactivateContact,
  reactivateContact,
  updateContact,
} from '../api';

/** Contato salvo vai direto para o cache do detalhe; as listas são revalidadas (docs/06 §6.3). */
function useStoreContact() {
  const queryClient = useQueryClient();
  return (contact: Contact) => {
    queryClient.setQueryData(contactQueryOptions(contact.id).queryKey, contact);
    void queryClient.invalidateQueries({ queryKey: ['contacts'] });
  };
}

/** RF05 (UC04): 201 → aviso e detalhe do novo contato. */
export function useCreateContact() {
  const store = useStoreContact();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (input: CreateContactInput) => createContact(input),
    onSuccess: async (contact) => {
      store(contact);
      toast.success('Contato cadastrado.');
      await navigate({ to: '/contatos/$id', params: { id: contact.id } });
    },
  });
}

/** RF10 (UC07): envia a versão lida; 412 fica para o formulário tratar. */
export function useUpdateContact() {
  const store = useStoreContact();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: ({
      contact,
      input,
    }: {
      contact: Pick<Contact, 'id' | 'version'>;
      input: UpdateContactInput;
    }) => updateContact(contact, input),
    onSuccess: async (contact) => {
      store(contact);
      toast.success('Alterações salvas.');
      await navigate({ to: '/contatos/$id', params: { id: contact.id } });
    },
  });
}

/** RF12 (UC09); idempotente. */
export function useReactivateContact(id: string) {
  const store = useStoreContact();

  return useMutation({
    mutationFn: () => reactivateContact(id),
    onSuccess: store,
  });
}

/** RF11 (UC08): o aviso oferece "Desfazer", que reativa o contato. */
export function useDeactivateContact(id: string) {
  const store = useStoreContact();
  const reactivate = useReactivateContact(id);

  return useMutation({
    mutationFn: () => deactivateContact(id),
    onSuccess: (contact) => {
      store(contact);
      toast.success('Contato inativado.', {
        action: {
          label: 'Desfazer',
          onClick: () => {
            reactivate.mutate(undefined, {
              onSuccess: () => toast.success('Contato reativado.'),
              onError: () => toast.error('Não foi possível reativar o contato.'),
            });
          },
        },
      });
    },
  });
}

/** RF14 (UC11, ADR-009): após eliminar, o contato some do cache e volta-se à lista. */
export function useAnonymizeContact(contact: Pick<Contact, 'id' | 'name'>) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: () => anonymizeContact(contact.id),
    onSuccess: async () => {
      toast.success(`Dados de ${contact.name} eliminados.`);
      // Sai do detalhe antes de limpar o cache, para a tela não buscar o contato eliminado
      await navigate({ to: '/contatos' });
      queryClient.removeQueries({ queryKey: contactQueryOptions(contact.id).queryKey });
      void queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}
