import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from './test/axe';
import { renderRoute } from './test/render';

describe('layout raiz', () => {
  it('renderiza a página inicial com título e conteúdo principal', async () => {
    renderRoute('/');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Gerenciador de Contatos' }),
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

  it('não tem violações de acessibilidade', async () => {
    const { container } = renderRoute('/');
    await screen.findByRole('heading', { level: 1 });

    await expectNoAxeViolations(container);
  });
});
