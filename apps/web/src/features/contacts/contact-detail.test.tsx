import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/test/axe';
import { editElsewhere, findContact } from '@/test/msw/contacts';
import { API, problem } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderRoute } from '@/test/render';

const ACTIVE = 'André Costa';
const INACTIVE = 'Carlos Eduardo Melo';

async function openDetail(name: string) {
  const result = renderRoute(`/contatos/${findContact(name).id}`);
  await screen.findByRole('heading', { level: 1, name });
  return result;
}

describe('Detalhe do contato (RF09, UC06)', () => {
  it('mostra os dados formatados, status e ações do contato ativo', async () => {
    editElsewhere(ACTIVE, { phone: '+558133330000', phoneFormatted: '(81) 3333-0000' });
    await openDetail(ACTIVE);

    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('(81) 99990-0001')).toBeInTheDocument();
    expect(screen.getByText('(81) 3333-0000')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'andre.costa@empresa.com' })).toHaveAttribute(
      'href',
      'mailto:andre.costa@empresa.com',
    );
    expect(screen.getByRole('button', { name: `Favoritar ${ACTIVE}` })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute(
      'href',
      `/contatos/${findContact(ACTIVE).id}/editar`,
    );
    expect(screen.getByRole('button', { name: 'Inativar' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Excluir dados definitivamente' }),
    ).not.toBeInTheDocument();
    expect(document.title).not.toContain(ACTIVE);
    await expectNoAxeViolations(document.body);
  });

  it('o contato inativo oferece reativar e excluir os dados, e mostra quando foi inativado', async () => {
    await openDetail(INACTIVE);

    expect(screen.getByText('Inativo')).toBeInTheDocument();
    expect(screen.getByText('Inativado em')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reativar' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Excluir dados definitivamente' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inativar' })).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('a lista leva ao detalhe pelo nome do contato', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/contatos');

    await user.click(await screen.findByRole('link', { name: ACTIVE }));

    expect(await screen.findByRole('heading', { level: 1, name: ACTIVE })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/contatos/${findContact(ACTIVE).id}`);
  });
});

describe('Inativar (RF11, UC08)', () => {
  it('cancelar devolve o foco ao gatilho e não altera o contato', async () => {
    const user = userEvent.setup();
    await openDetail(ACTIVE);
    const trigger = screen.getByRole('button', { name: 'Inativar' });

    await user.click(trigger);
    const dialog = await screen.findByRole('alertdialog', { name: `Inativar ${ACTIVE}?` });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await expectNoAxeViolations(document.body);

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    expect(findContact(ACTIVE).status).toBe('active');
  });

  it('confirmar inativa, leva o foco ao título e oferece desfazer', async () => {
    const user = userEvent.setup();
    await openDetail(ACTIVE);

    await user.click(screen.getByRole('button', { name: 'Inativar' }));
    await user.click(await screen.findByRole('button', { name: 'Inativar contato' }));

    expect(await screen.findByText('Inativo')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: ACTIVE })).toHaveFocus();
    });
    expect(findContact(ACTIVE).status).toBe('inactive');

    await user.click(await screen.findByRole('button', { name: 'Desfazer' }));

    expect(await screen.findByText('Ativo')).toBeInTheDocument();
    expect(findContact(ACTIVE).status).toBe('active');
  });

  it('falha ao inativar mantém o diálogo aberto e avisa', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/contacts/:id/deactivate`, () => problem('INTERNAL_ERROR', 'Erro interno')),
    );
    await openDetail(ACTIVE);

    await user.click(screen.getByRole('button', { name: 'Inativar' }));
    await user.click(await screen.findByRole('button', { name: 'Inativar contato' }));

    expect(
      await screen.findByText('Não foi possível inativar o contato. Tente novamente.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
});

describe('Reativar (RF12, UC09)', () => {
  it('reativa sem confirmação e leva o foco ao título', async () => {
    const user = userEvent.setup();
    await openDetail(INACTIVE);

    await user.click(screen.getByRole('button', { name: 'Reativar' }));

    expect(await screen.findByText('Ativo')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: INACTIVE })).toHaveFocus();
    expect(await screen.findByText('Contato reativado.')).toBeInTheDocument();
  });

  it('falha ao reativar avisa e mantém o estado', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API}/contacts/:id/reactivate`, () => problem('INTERNAL_ERROR', 'Erro interno')),
    );
    await openDetail(INACTIVE);

    await user.click(screen.getByRole('button', { name: 'Reativar' }));

    expect(
      await screen.findByText('Não foi possível reativar o contato. Tente novamente.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });
});

describe('Excluir dados (RF14, UC11, ADR-009)', () => {
  it('exige digitar o nome; cancelar devolve o foco ao gatilho', async () => {
    const user = userEvent.setup();
    await openDetail(INACTIVE);
    const trigger = screen.getByRole('button', { name: 'Excluir dados definitivamente' });

    await user.click(trigger);
    const dialog = await screen.findByRole('alertdialog', {
      name: `Excluir os dados de ${INACTIVE}?`,
    });
    const confirm = within(dialog).getByRole('button', { name: 'Excluir definitivamente' });
    expect(confirm).toBeDisabled();
    await user.type(
      within(dialog).getByLabelText('Digite o nome do contato para confirmar'),
      'Carlos',
    );
    expect(confirm).toBeDisabled();
    await expectNoAxeViolations(document.body);

    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    expect(findContact(INACTIVE).status).toBe('inactive');
  });

  it('com o nome confirmado, elimina e volta à lista', async () => {
    const user = userEvent.setup();
    const { router } = await openDetail(INACTIVE);
    const id = findContact(INACTIVE).id;

    await user.click(screen.getByRole('button', { name: 'Excluir dados definitivamente' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.type(
      within(dialog).getByLabelText('Digite o nome do contato para confirmar'),
      '  carlos  eduardo melo ',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Excluir definitivamente' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Contatos' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/contatos');
    expect(await screen.findByText(`Dados de ${INACTIVE} eliminados.`)).toBeInTheDocument();
    expect(() => findContact(INACTIVE)).toThrow();
    expect(router.options.context.queryClient.getQueryData(['contact', id])).toBeUndefined();
  });

  it('se o contato voltou a ficar ativo, orienta inativar primeiro', async () => {
    const user = userEvent.setup();
    await openDetail(INACTIVE);
    editElsewhere(INACTIVE, { status: 'active', deactivatedAt: null });

    await user.click(screen.getByRole('button', { name: 'Excluir dados definitivamente' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.type(
      within(dialog).getByLabelText('Digite o nome do contato para confirmar'),
      INACTIVE,
    );
    await user.click(within(dialog).getByRole('button', { name: 'Excluir definitivamente' }));

    expect(
      await screen.findByText('Inative o contato antes de excluir os dados.'),
    ).toBeInTheDocument();
  });

  it('outras falhas mostram aviso genérico', async () => {
    const user = userEvent.setup();
    server.use(http.delete(`${API}/contacts/:id`, () => problem('INTERNAL_ERROR', 'Erro')));
    await openDetail(INACTIVE);

    await user.click(screen.getByRole('button', { name: 'Excluir dados definitivamente' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.type(
      within(dialog).getByLabelText('Digite o nome do contato para confirmar'),
      INACTIVE,
    );
    await user.click(within(dialog).getByRole('button', { name: 'Excluir definitivamente' }));

    expect(
      await screen.findByText('Não foi possível excluir os dados. Tente novamente.'),
    ).toBeInTheDocument();
  });
});

describe('Contato não encontrado (404)', () => {
  it.each([
    ['id inexistente', '/contatos/0192f3a1-0000-7000-8000-999999999999'],
    ['id inválido', '/contatos/nao-e-um-id'],
    ['edição de id inexistente', '/contatos/0192f3a1-0000-7000-8000-999999999999/editar'],
  ])('%s mostra a mesma tela, sem revelar se o contato existe', async (_, path) => {
    renderRoute(path);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Contato não encontrado' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para contatos' })).toHaveAttribute(
      'href',
      '/contatos',
    );
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('Contato não encontrado · Agenda Unimed');
    });
    await expectNoAxeViolations(document.body);
  });

  it('o contato eliminado depois também cai na mesma tela', async () => {
    const id = findContact(INACTIVE).id;
    server.use(
      http.get(`${API}/contacts/:id`, () => problem('NOT_FOUND', 'Contato não encontrado')),
    );
    renderRoute(`/contatos/${id}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Contato não encontrado' }),
    ).toBeInTheDocument();
  });

  it('outras falhas da API não viram "não encontrado"', async () => {
    server.use(http.get(`${API}/contacts/:id`, () => problem('INTERNAL_ERROR', 'Erro interno')));
    renderRoute(`/contatos/${findContact(ACTIVE).id}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Algo deu errado' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Contato não encontrado')).not.toBeInTheDocument();
  });
});
