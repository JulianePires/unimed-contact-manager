import { Link } from '@tanstack/react-router';
import { ShieldCheckIcon } from 'lucide-react';

const SECTIONS = [
  {
    id: 'privacidade-finalidade',
    title: 'Para que usamos os dados',
    items: [
      'Seu nome, e-mail e senha servem só para criar sua conta e proteger o acesso à sua agenda.',
      'Os contatos que você cadastra ou importa são usados apenas para montar a sua agenda. Nenhuma outra conta tem acesso a eles.',
    ],
  },
  {
    id: 'privacidade-dados',
    title: 'Quais dados tratamos',
    items: [
      'Da sua conta: nome, e-mail e senha. A senha é guardada apenas como hash (argon2id), nunca em texto.',
      'Dos seus contatos: nome, e-mail, celular e telefone.',
    ],
  },
  {
    id: 'privacidade-retencao',
    title: 'Por quanto tempo',
    items: [
      'O arquivo de uma importação é apagado assim que o processamento termina.',
      'As linhas com erro de uma importação ficam disponíveis por 30 dias e depois são apagadas.',
      'Os contatos ficam guardados até você eliminar os dados deles.',
    ],
  },
  {
    id: 'privacidade-direitos',
    title: 'Seus direitos e os dos seus contatos',
    items: [
      'Consultar e corrigir os dados a qualquer momento.',
      'Inativar um contato e, depois, eliminar definitivamente os dados dele.',
      'Excluir uma importação e as linhas com erro dela.',
    ],
  },
  {
    id: 'privacidade-cookies',
    title: 'Cookies e navegador',
    items: [
      'Usamos um único cookie, de sessão, necessário para manter você conectado. A sessão expira após 2 horas sem uso.',
      'Não usamos cookies de análise nem de terceiros, e nenhum dado fica guardado no navegador.',
    ],
  },
];

/** Aviso de privacidade completo (ADR-009 §6): finalidade, dados, retenção e direitos. */
export function PrivacyNotice() {
  return (
    <div className="grid gap-6">
      {SECTIONS.map(({ id, title, items }) => (
        <section key={id} aria-labelledby={id}>
          <h2 id={id} className="text-lg font-semibold">
            {title}
          </h2>
          <ul className="mt-2 grid gap-1 pl-5 text-muted-foreground">
            {items.map((item) => (
              <li key={item} className="list-disc">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Resumo exibido no cadastro (UC01), com acesso ao aviso completo. */
export function PrivacySummary() {
  return (
    <aside
      aria-labelledby="aviso-privacidade"
      className="rounded-md border border-border bg-surface p-4 text-sm"
    >
      <h2 id="aviso-privacidade" className="flex items-center gap-2 font-semibold">
        <ShieldCheckIcon aria-hidden="true" className="size-4 text-primary" />
        Aviso de privacidade
      </h2>
      <p className="mt-2 text-muted-foreground">
        Usamos seu nome e e-mail só para criar sua conta, e a senha é guardada apenas como hash. Os
        contatos da sua agenda são visíveis somente para você, e o único cookie é o de sessão.
      </p>
      <p className="mt-2">
        <Link to="/privacidade" className="text-primary underline underline-offset-2">
          Ler o aviso de privacidade completo
        </Link>
      </p>
    </aside>
  );
}
