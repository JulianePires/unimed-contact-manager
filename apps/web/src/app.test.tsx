import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './app';
import { createQueryClient } from './lib/query-client';
import { expectNoAxeViolations } from './test/axe';
import { renderRoute } from './test/render';

describe('layout raiz', () => {
  it('renderiza a página inicial com título e conteúdo principal', async () => {
    renderRoute('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Agenda Unimed' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
  });

  it('oferece skip link para o conteúdo principal', async () => {
    renderRoute('/');

    expect(await screen.findByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#conteudo',
    );
  });

  it('mostra página de não encontrado para rotas desconhecidas', async () => {
    renderRoute('/rota-que-nao-existe');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao início' })).toHaveAttribute('href', '/');
  });

  it('volta ao início pelo link da página de não encontrado', async () => {
    const { router } = renderRoute('/rota-que-nao-existe');
    await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' });

    await router.navigate({ to: '/' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Agenda Unimed' }),
    ).toBeInTheDocument();
  });

  it('mantém a árvore ao re-renderizar com os mesmos providers e troca ao receber outros', async () => {
    const { router, rerender } = renderRoute('/');
    await screen.findByRole('heading', { level: 1 });
    const queryClient = createQueryClient();

    rerender(<App queryClient={queryClient} router={router} />);
    rerender(<App queryClient={queryClient} router={router} />);

    expect(screen.getByRole('main')).toHaveAttribute('id', 'conteudo');
  });

  it.each([
    ['página inicial', '/', 'Agenda Unimed'],
    ['página de não encontrado', '/rota-que-nao-existe', 'Página não encontrada'],
  ])('mantém a %s ao navegar para uma âncora na mesma rota', async (_, path, heading) => {
    const { router } = renderRoute(path);
    await screen.findByRole('heading', { level: 1, name: heading });

    await router.navigate({ to: path, hash: 'conteudo' });

    expect(router.state.location.hash).toBe('conteudo');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(heading);
  });

  it('não tem violações de acessibilidade', async () => {
    const { container } = renderRoute('/');
    await screen.findByRole('heading', { level: 1 });

    await expectNoAxeViolations(container);
  });
});
