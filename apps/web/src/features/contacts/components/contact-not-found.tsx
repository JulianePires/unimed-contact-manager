import { Link } from '@tanstack/react-router';
import { SearchXIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** Mesma tela para inexistente, de outra conta ou eliminado: não revela se o contato existe. */
export function ContactNotFound() {
  return (
    <>
      <title>Contato não encontrado · Agenda Unimed</title>
      <div className="grid justify-items-start gap-3">
        <SearchXIcon aria-hidden="true" className="size-8 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Contato não encontrado</h1>
        <p className="text-muted-foreground">
          O link pode estar incorreto ou o contato não está mais disponível na sua agenda.
        </p>
        <Button asChild variant="secondary">
          <Link to="/contatos">Voltar para contatos</Link>
        </Button>
      </div>
    </>
  );
}
