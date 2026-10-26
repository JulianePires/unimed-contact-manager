import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/test/axe';
import { API, problem, sessionPassword, sessionUser, unauthenticatedMe } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderRoute } from '@/test/render';

type User = ReturnType<typeof userEvent.setup>;

async function signIn(user: User, email: string, password: string) {
  await user.type(await screen.findByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('Entrar (RF02)', () => {
  beforeEach(() => {
    server.use(unauthenticatedMe);
  });

  it('com credenciais válidas volta à rota de origem', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/entrar?redirect=%2Fimportacoes');

    await signIn(user, sessionUser.email, sessionPassword);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Importações' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/importacoes');
    expect(router.options.context.queryClient.getQueryData(['me'])).toEqual(sessionUser);
  });

  it('sem rota de origem segue para a agenda', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/entrar');

    await signIn(user, `  ${sessionUser.email}  `, sessionPassword);

    expect(await screen.findByRole('heading', { level: 1, name: 'Contatos' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/contatos');
  });

  it('credenciais inválidas mostram alerta genérico com foco', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/entrar');

    await signIn(user, sessionUser.email, 'senha-errada-123');

    const alert = await screen.findByRole('alert', { name: 'Não foi possível entrar' });
    expect(alert).toHaveTextContent('E-mail ou senha inválidos.');
    expect(alert).toHaveFocus();
    expect(screen.getByLabelText('E-mail')).not.toHaveAttribute('aria-invalid');
    expect(router.state.location.pathname).toBe('/entrar');
    await expectNoAxeViolations(document.body);
  });

  it('envio vazio foca o resumo, que leva a cada campo com erro', async () => {
    const user = userEvent.setup();
    renderRoute('/entrar');

    await user.click(await screen.findByRole('button', { name: 'Entrar' }));

    const alert = await screen.findByRole('alert', { name: 'Não foi possível entrar' });
    expect(alert).toHaveFocus();
    const email = screen.getByLabelText('E-mail');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Informe o e-mail.');
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription('Informe a senha.');

    await user.click(screen.getByRole('link', { name: 'Informe a senha.' }));

    expect(screen.getByLabelText('Senha')).toHaveFocus();
    await expectNoAxeViolations(document.body);
  });

  it('valida o e-mail ao sair do campo e remove o erro quando corrigido', async () => {
    const user = userEvent.setup();
    renderRoute('/entrar');
    const email = await screen.findByLabelText('E-mail');

    await user.type(email, 'maria@');
    expect(email).not.toHaveAttribute('aria-invalid');
    await user.tab();

    expect(email).toHaveAccessibleDescription('Informe um e-mail válido.');
    expect(screen.getByLabelText('Senha')).not.toHaveAttribute('aria-invalid');

    await user.type(email, 'empresa.com');
    await user.tab();

    expect(email).not.toHaveAttribute('aria-invalid');
    expect(
      screen.queryByRole('alert', { name: 'Não foi possível entrar' }),
    ).not.toBeInTheDocument();
  });

  it('leva os erros por campo da API (422) ao campo, até ser editado', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/auth/login`, () =>
        problem('VALIDATION_ERROR', 'Dados inválidos', {
          errors: [{ field: 'email', code: 'INVALID_EMAIL', message: 'E-mail não aceito.' }],
        }),
      ),
    );
    renderRoute('/entrar');

    await signIn(user, sessionUser.email, sessionPassword);

    expect(await screen.findByRole('link', { name: 'E-mail não aceito.' })).toBeInTheDocument();
    const email = screen.getByLabelText('E-mail');
    expect(email).toHaveAccessibleDescription('E-mail não aceito.');

    await user.type(email, 'r');

    expect(email).not.toHaveAttribute('aria-invalid');
  });

  it.each([
    [
      'limite de tentativas',
      problem('RATE_LIMITED', 'Muitas requisições'),
      'Muitas tentativas de entrar. Aguarde alguns minutos e tente novamente.',
    ],
    [
      'falha do servidor',
      problem('INTERNAL_ERROR', 'Erro interno'),
      'Não foi possível entrar agora. Tente novamente em instantes.',
    ],
    [
      'erro de rede',
      HttpResponse.error(),
      'Não foi possível entrar agora. Tente novamente em instantes.',
    ],
  ])('%s mostra mensagem sem detalhes técnicos', async (_, response, message) => {
    const user = userEvent.setup();
    server.use(http.post(`${API}/auth/login`, () => response));
    renderRoute('/entrar');

    await signIn(user, sessionUser.email, sessionPassword);

    expect(await screen.findByRole('alert', { name: 'Não foi possível entrar' })).toHaveTextContent(
      message,
    );
  });

  it('usa os tokens de autocomplete de login', async () => {
    renderRoute('/entrar');

    expect(await screen.findByLabelText('E-mail')).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Senha')).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/criar-conta',
    );
  });

  it('avisa que a sessão expirou quando chega por ?motivo=sessao-expirada', async () => {
    renderRoute('/entrar?redirect=%2Fcontatos&motivo=sessao-expirada');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Sua sessão expirou' }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('Sessão expirada · Agenda Unimed');
    });
    await expectNoAxeViolations(document.body);
  });

  it('ignora motivo desconhecido', async () => {
    const { router } = renderRoute('/entrar?motivo=outro');

    await screen.findByRole('heading', { level: 1, name: 'Entrar' });

    expect(screen.queryByText('Sua sessão expirou')).not.toBeInTheDocument();
    expect(router.state.location.search).toEqual({});
  });

  it('não tem violações de acessibilidade', async () => {
    renderRoute('/entrar');
    await screen.findByRole('heading', { level: 1, name: 'Entrar' });

    await expectNoAxeViolations(document.body);
  });
});

describe('Entrar com sessão ativa', () => {
  it('leva direto à agenda', async () => {
    const { router } = renderRoute('/entrar');

    expect(await screen.findByRole('heading', { level: 1, name: 'Contatos' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/contatos');
  });

  it('respeita a rota de origem', async () => {
    const { router } = renderRoute('/entrar?redirect=%2Fimportacoes');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Importações' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/importacoes');
  });
});
