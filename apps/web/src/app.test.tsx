import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';

import { App } from './app';
import { createQueryClient } from './lib/query-client';
import { expectNoAxeViolations } from './test/axe';
import { API, problem, sessionUser, unauthenticatedMe } from './test/msw/handlers';
import { server } from './test/msw/server';
import { renderRoute } from './test/render';

async function openAccountMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: `Conta de ${sessionUser.name}` }));
}

describe('área autenticada', () => {
  it('abre a agenda como tela inicial com marca, abas e conta', async () => {
    const { router } = renderRoute('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Contatos' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/contatos');
    expect(screen.getByRole('link', { name: 'Agenda Unimed' })).toHaveAttribute(
      'href',
      '/contatos',
    );
    expect(
      screen.getByRole('button', { name: `Conta de ${sessionUser.name}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
    expect(screen.getByRole('contentinfo')).toHaveTextContent('LGPD');
  });

  it('marca a aba atual com aria-current e acompanha a navegação', async () => {
    const user = userEvent.setup();
    renderRoute('/contatos');
    const nav = await screen.findByRole('navigation', { name: 'Principal' });

    expect(within(nav).getByRole('link', { name: 'Contatos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Importações' })).not.toHaveAttribute(
      'aria-current',
    );

    await user.click(within(nav).getByRole('link', { name: 'Importações' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Importações' }),
    ).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Importações' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Contatos' })).not.toHaveAttribute('aria-current');
  });

  it('"Sair" encerra a sessão, limpa o cache e volta ao login', async () => {
    const user = userEvent.setup();
    let ended = false;
    server.use(
      http.post(`${API}/auth/logout`, () => {
        ended = true;
        server.use(unauthenticatedMe);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderRoute('/contatos');

    await openAccountMenu(user);
    expect(await screen.findByText(sessionUser.email)).toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(ended).toBe(true);
    expect(router.state.location.pathname).toBe('/entrar');
    expect(router.options.context.queryClient.getQueryData(['me'])).toBeUndefined();
  });

  it('"Sair de todas as sessões" pede confirmação e só então encerra todas', async () => {
    const user = userEvent.setup();
    let ended = false;
    server.use(
      http.post(`${API}/auth/logout-all`, () => {
        ended = true;
        server.use(unauthenticatedMe);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { router } = renderRoute('/contatos');

    await openAccountMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Sair de todas as sessões' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Sair de todas as sessões?' });

    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    expect(ended).toBe(false);
    await expectNoAxeViolations(document.body);

    await user.click(within(dialog).getByRole('button', { name: 'Sair de todas' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(ended).toBe(true);
    expect(router.state.location.pathname).toBe('/entrar');
    expect(router.options.context.queryClient.getQueryData(['me'])).toBeUndefined();
  });

  it('cancelar a saída de todas as sessões mantém a sessão e devolve o foco ao menu', async () => {
    const user = userEvent.setup();
    renderRoute('/contatos');

    await openAccountMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Sair de todas as sessões' }));
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Conta de ${sessionUser.name}` })).toHaveFocus();
    expect(screen.getByRole('heading', { level: 1, name: 'Contatos' })).toBeInTheDocument();
  });

  it('volta ao login mesmo se a sessão já tiver expirado no servidor', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/auth/logout`, () => {
        server.use(unauthenticatedMe);
        return problem('UNAUTHENTICATED', 'Sessão expirada');
      }),
    );
    const { router } = renderRoute('/contatos');

    await openAccountMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
  });

  it('mantém a sessão e avisa quando o servidor não consegue encerrá-la', async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API}/auth/logout`, () => problem('INTERNAL_ERROR', 'Erro interno')));
    const { router } = renderRoute('/contatos');

    await openAccountMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Sair' }));

    expect(await screen.findByText('Não foi possível sair. Tente novamente.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/contatos');
    expect(router.options.context.queryClient.getQueryData(['me'])).toEqual(sessionUser);
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = renderRoute('/contatos');
    await screen.findByRole('heading', { level: 1, name: 'Contatos' });

    await expectNoAxeViolations(container);
  });
});

describe('sem sessão', () => {
  beforeEach(() => {
    server.use(unauthenticatedMe);
  });

  it('leva ao login guardando a rota pedida', async () => {
    const { router } = renderRoute('/importacoes?page=2');

    expect(await screen.findByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/entrar');
    expect(router.state.location.search).toEqual({ redirect: '/importacoes?page=2' });
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Agenda Unimed' })).toHaveAttribute('href', '/entrar');
  });

  it('descarta redirect para fora da aplicação', async () => {
    const { router } = renderRoute('/entrar?redirect=%2F%2Fevil.example');

    await screen.findByRole('heading', { level: 1, name: 'Entrar' });

    expect(router.state.location.search).toEqual({});
  });

  it('mostra falha da API sem detalhes técnicos e permite tentar de novo', async () => {
    const user = userEvent.setup();
    server.use(http.get(`${API}/auth/me`, () => problem('SERVICE_UNAVAILABLE', 'Indisponível')));
    renderRoute('/contatos');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Algo deu errado' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Indisponível')).not.toBeInTheDocument();

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Contatos' })).toBeInTheDocument();
  });
});

describe('layout raiz', () => {
  it('oferece skip link para o conteúdo principal', async () => {
    renderRoute('/privacidade');

    expect(await screen.findByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#conteudo',
    );
  });

  it('mostra página de não encontrado no layout público', async () => {
    renderRoute('/rota-que-nao-existe');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
    expect(screen.getByRole('link', { name: 'Aviso de privacidade' })).toHaveAttribute(
      'href',
      '/privacidade',
    );
  });

  it('volta ao início pelo link da página de não encontrado', async () => {
    const user = userEvent.setup();
    renderRoute('/rota-que-nao-existe');

    await user.click(await screen.findByRole('link', { name: 'Voltar ao início' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Contatos' })).toBeInTheDocument();
  });

  it('mantém a árvore ao re-renderizar com os mesmos providers e troca ao receber outros', async () => {
    const { router, rerender } = renderRoute('/privacidade');
    await screen.findByRole('heading', { level: 1 });
    const queryClient = createQueryClient();

    rerender(<App queryClient={queryClient} router={router} />);
    rerender(<App queryClient={queryClient} router={router} />);

    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
  });

  it.each([
    ['aviso de privacidade', '/privacidade', 'Aviso de privacidade'],
    ['página de não encontrado', '/rota-que-nao-existe', 'Página não encontrada'],
  ])('mantém o %s ao navegar para uma âncora na mesma rota', async (_, path, heading) => {
    const { router } = renderRoute(path);
    await screen.findByRole('heading', { level: 1, name: heading });

    await router.navigate({ to: path, hash: 'conteudo' });

    expect(router.state.location.hash).toBe('conteudo');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  });

  it('não tem violações de acessibilidade na página de não encontrado', async () => {
    const { container } = renderRoute('/rota-que-nao-existe');
    await screen.findByRole('heading', { level: 1 });

    await expectNoAxeViolations(container);
  });
});
