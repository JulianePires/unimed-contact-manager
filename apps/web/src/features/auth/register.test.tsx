import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/test/axe';
import { API, problem, sessionUser } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderRoute } from '@/test/render';

const PASSWORD = 'senha-segura-2026';

async function fillRegistration(
  user: ReturnType<typeof userEvent.setup>,
  { name, email, password }: { name: string; email: string; password: string },
) {
  await user.type(await screen.findByLabelText('Nome'), name);
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
}

describe('Criar conta (RF01)', () => {
  it('cria a conta, inicia a sessão e segue para a agenda', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/criar-conta');

    await fillRegistration(user, {
      name: 'João Souza',
      email: 'joao@empresa.com',
      password: PASSWORD,
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Contatos' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/contatos');
    expect(await screen.findByText('Conta criada.')).toBeInTheDocument();
    expect(router.options.context.queryClient.getQueryData(['me'])).toMatchObject({
      name: 'João Souza',
      email: 'joao@empresa.com',
    });
  });

  it('e-mail já cadastrado (409) recebe mensagem genérica, sem confirmar a conta', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/criar-conta');

    await fillRegistration(user, { name: 'Maria', email: sessionUser.email, password: PASSWORD });

    const alert = await screen.findByRole('alert', { name: 'Não foi possível criar a conta' });
    expect(alert).toHaveTextContent(
      'Não foi possível concluir o cadastro. Verifique os dados ou entre, se você já tiver uma conta.',
    );
    expect(alert).not.toHaveTextContent(/já cadastrado|já existe/i);
    expect(alert).toHaveFocus();
    expect(router.state.location.pathname).toBe('/criar-conta');
    await expectNoAxeViolations(document.body);
  });

  it('aplica a política de senha dos contracts, com a dica ligada ao campo', async () => {
    const user = userEvent.setup();
    renderRoute('/criar-conta');

    await fillRegistration(user, { name: 'João', email: 'joao@empresa.com', password: 'curta' });

    const password = screen.getByLabelText('Senha');
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAccessibleDescription(
      'Use ao menos 12 caracteres. Uma frase longa é mais fácil de lembrar. A senha deve ter ao menos 12 caracteres.',
    );
    expect(
      within(screen.getByRole('alert', { name: 'Não foi possível criar a conta' })).getByRole(
        'link',
        {
          name: 'A senha deve ter ao menos 12 caracteres.',
        },
      ),
    ).toBeInTheDocument();
  });

  it('mostra limite de tentativas sem detalhes técnicos', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/auth/register`, () => problem('RATE_LIMITED', 'Muitas requisições')),
    );
    renderRoute('/criar-conta');

    await fillRegistration(user, { name: 'João', email: 'joao@empresa.com', password: PASSWORD });

    expect(
      await screen.findByRole('alert', { name: 'Não foi possível criar a conta' }),
    ).toHaveTextContent('Muitas tentativas de cadastro. Aguarde alguns minutos e tente novamente.');
  });

  it('leva os erros por campo da API (422) ao campo', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/auth/register`, () =>
        problem('VALIDATION_ERROR', 'Dados inválidos', {
          errors: [{ field: 'name', code: 'NAME_TOO_SHORT', message: 'Nome não aceito.' }],
        }),
      ),
    );
    renderRoute('/criar-conta');

    await fillRegistration(user, { name: 'João', email: 'joao@empresa.com', password: PASSWORD });

    expect(await screen.findByRole('link', { name: 'Nome não aceito.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveAccessibleDescription('Nome não aceito.');
  });

  it('usa os tokens de autocomplete de cadastro', async () => {
    renderRoute('/criar-conta');

    expect(await screen.findByLabelText('Nome')).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/entrar');
  });

  it('exibe o aviso de privacidade com acesso ao texto completo', async () => {
    const user = userEvent.setup();
    renderRoute('/criar-conta');

    const notice = await screen.findByRole('complementary', { name: 'Aviso de privacidade' });
    await user.click(
      within(notice).getByRole('link', { name: 'Ler o aviso de privacidade completo' }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Aviso de privacidade' }),
    ).toBeInTheDocument();
  });

  it('não tem violações de acessibilidade', async () => {
    renderRoute('/criar-conta');
    await screen.findByRole('heading', { level: 1, name: 'Criar conta' });

    await expectNoAxeViolations(document.body);
  });
});

describe('Aviso de privacidade (ADR-009 §6)', () => {
  it('descreve finalidade, dados, retenção, direitos e cookies', async () => {
    renderRoute('/privacidade');

    await screen.findByRole('heading', { level: 1, name: 'Aviso de privacidade' });

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      'Para que usamos os dados',
      'Quais dados tratamos',
      'Por quanto tempo',
      'Seus direitos e os dos seus contatos',
      'Cookies e navegador',
    ]);
    expect(screen.getByRole('region', { name: 'Por quanto tempo' })).toHaveTextContent('30 dias');
  });

  it('não tem violações de acessibilidade', async () => {
    renderRoute('/privacidade');
    await screen.findByRole('heading', { level: 1, name: 'Aviso de privacidade' });

    await expectNoAxeViolations(document.body);
  });
});
