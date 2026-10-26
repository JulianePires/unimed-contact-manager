import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/test/axe';
import { editElsewhere, findContact } from '@/test/msw/contacts';
import { API } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderRoute } from '@/test/render';

type User = ReturnType<typeof userEvent.setup>;

const ACTIVE_OWNER = 'André Costa';
const INACTIVE_OWNER = 'Carlos Eduardo Melo';

async function fillNewContact(user: User, { mobile }: { mobile: string }) {
  await user.type(await screen.findByLabelText('Nome'), 'Beatriz Nogueira');
  await user.type(screen.getByLabelText('E-mail'), 'beatriz@empresa.com');
  await user.type(screen.getByLabelText('Celular'), mobile);
  await user.click(screen.getByRole('button', { name: 'Cadastrar contato' }));
}

describe('Novo contato (RF05, UC04)', () => {
  it('cadastra e abre o detalhe do contato', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/contatos/novo');

    await fillNewContact(user, { mobile: '81988887777' });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Beatriz Nogueira' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/contatos\/[0-9a-f-]{36}$/);
    expect(screen.getByText('(81) 98888-7777')).toBeInTheDocument();
    expect(await screen.findByText('Contato cadastrado.')).toBeInTheDocument();
  });

  it('mostra a máscara no celular, mas envia o que foi digitado', async () => {
    const user = userEvent.setup();
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API}/contacts`, async ({ request }) => {
        bodies.push(await request.clone().json());
      }),
    );
    renderRoute('/contatos/novo');

    await fillNewContact(user, { mobile: '81988887777' });

    expect(screen.queryByLabelText('Celular')).not.toBeInTheDocument();
    expect(bodies[0]).toMatchObject({ mobile: '81988887777', phone: '' });
  });

  it('formata enquanto digita e apagar a máscara apaga o dígito', async () => {
    const user = userEvent.setup();
    renderRoute('/contatos/novo');
    const mobile = await screen.findByLabelText('Celular');

    await user.type(mobile, '81988887777');
    expect(mobile).toHaveValue('(81) 98888-7777');
    expect(mobile).toHaveAttribute('type', 'tel');
    expect(mobile).toHaveAttribute('autocomplete', 'tel');

    await user.clear(mobile);
    await user.type(mobile, '819');
    expect(mobile).toHaveValue('(81) 9');
    await user.type(mobile, '{Backspace}{Backspace}');
    expect(mobile).toHaveValue('8');
  });

  it('envio inválido foca o resumo, com erros dos contracts por campo', async () => {
    const user = userEvent.setup();
    renderRoute('/contatos/novo');

    await user.type(await screen.findByLabelText('Celular'), '8133330000');
    await user.click(screen.getByRole('button', { name: 'Cadastrar contato' }));

    const summary = await screen.findByRole('alert', { name: 'Não foi possível salvar o contato' });
    expect(summary).toHaveFocus();
    expect(within(summary).getByRole('link', { name: 'Informe o nome.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Celular')).toHaveAccessibleDescription(
      'Com DDD. Ex.: (81) 99999-0000 Informe um número de celular válido.',
    );
    await expectNoAxeViolations(document.body);
  });

  it('409 de celular ativo: erro no campo e link para o contato existente', async () => {
    const user = userEvent.setup();
    renderRoute('/contatos/novo');

    await fillNewContact(user, { mobile: '81999900001' });

    const summary = await screen.findByRole('alert', { name: 'Não foi possível salvar o contato' });
    expect(summary).toHaveFocus();
    const mobile = screen.getByLabelText('Celular');
    expect(mobile).toHaveAccessibleDescription(
      'Com DDD. Ex.: (81) 99999-0000 Este celular já pertence a outro contato.',
    );
    expect(
      screen.getByRole('link', { name: 'Ver o contato que usa este celular' }),
    ).toHaveAttribute('href', `/contatos/${findContact(ACTIVE_OWNER).id}`);
    await expectNoAxeViolations(document.body);

    await user.type(mobile, '{Backspace}');

    expect(
      screen.queryByRole('link', { name: 'Ver o contato que usa este celular' }),
    ).not.toBeInTheDocument();
  });

  it('409 de celular inativo: "Reativar <nome>" reativa e abre o detalhe', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/contatos/novo');

    await fillNewContact(user, { mobile: '81999900004' });

    const alert = await screen.findByRole('alert', {
      name: 'Este celular pertence a um contato inativo',
    });
    expect(alert).toHaveFocus();
    await expectNoAxeViolations(document.body);

    await user.click(
      await within(alert).findByRole('button', { name: `Reativar ${INACTIVE_OWNER}` }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: INACTIVE_OWNER }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/contatos/${findContact(INACTIVE_OWNER).id}`);
    expect(findContact(INACTIVE_OWNER).status).toBe('active');
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('409 de celular inativo: "Usar outro número" volta ao campo', async () => {
    const user = userEvent.setup();
    renderRoute('/contatos/novo');

    await fillNewContact(user, { mobile: '81999900004' });
    const alert = await screen.findByRole('alert', {
      name: 'Este celular pertence a um contato inativo',
    });
    await user.click(within(alert).getByRole('button', { name: 'Usar outro número' }));

    expect(screen.getByLabelText('Celular')).toHaveFocus();
    expect(findContact(INACTIVE_OWNER).status).toBe('inactive');
  });

  it('falha inesperada mostra mensagem genérica no resumo', async () => {
    const user = userEvent.setup();
    server.use(http.post(`${API}/contacts`, () => new Response(null, { status: 500 })));
    renderRoute('/contatos/novo');

    await fillNewContact(user, { mobile: '81988887777' });

    expect(
      await screen.findByRole('alert', { name: 'Não foi possível salvar o contato' }),
    ).toHaveTextContent('Não foi possível salvar o contato agora. Tente novamente em instantes.');
  });
});

describe('Editar contato (RF10, UC07)', () => {
  it('abre preenchido, envia If-Match e volta ao detalhe', async () => {
    const user = userEvent.setup();
    const contact = findContact(ACTIVE_OWNER);
    const ifMatch: (string | null)[] = [];
    server.use(
      http.patch(`${API}/contacts/:id`, ({ request }) => {
        ifMatch.push(request.headers.get('if-match'));
      }),
    );
    renderRoute(`/contatos/${contact.id}/editar`);

    const name = await screen.findByLabelText('Nome');
    expect(name).toHaveValue(ACTIVE_OWNER);
    expect(screen.getByLabelText('Celular')).toHaveValue('(81) 99990-0001');
    await user.clear(name);
    await user.type(name, 'André Costa Lima');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'André Costa Lima' }),
    ).toBeInTheDocument();
    expect(ifMatch).toEqual(['"v1"']);
    expect(await screen.findByText('Alterações salvas.')).toBeInTheDocument();
  });

  it('412: avisa em âmbar, mantém o texto e só troca ao carregar a versão atual', async () => {
    const user = userEvent.setup();
    const contact = findContact(ACTIVE_OWNER);
    renderRoute(`/contatos/${contact.id}/editar`);
    const name = await screen.findByLabelText('Nome');
    editElsewhere(ACTIVE_OWNER, { name: 'André (outra sessão)' });

    await user.clear(name);
    await user.type(name, 'André digitado aqui');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    const alert = await screen.findByRole('alert', {
      name: 'Este contato foi alterado em outra sessão',
    });
    expect(alert).toHaveFocus();
    expect(alert).toHaveClass('border-warning');
    expect(screen.getByLabelText('Nome')).toHaveValue('André digitado aqui');
    expect(findContact('André (outra sessão)').version).toBe(2);
    await expectNoAxeViolations(document.body);

    await user.click(within(alert).getByRole('button', { name: 'Carregar versão atual' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Nome')).toHaveValue('André (outra sessão)');
    });
    expect(
      screen.queryByRole('alert', { name: 'Este contato foi alterado em outra sessão' }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'André (outra sessão)' }),
    ).toBeInTheDocument();
    expect(findContact('André (outra sessão)').version).toBe(3);
  });

  it('falha ao carregar a versão atual avisa sem perder o formulário', async () => {
    const user = userEvent.setup();
    const contact = findContact(ACTIVE_OWNER);
    renderRoute(`/contatos/${contact.id}/editar`);
    await screen.findByLabelText('Nome');
    editElsewhere(ACTIVE_OWNER, { email: 'novo@empresa.com' });
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    const alert = await screen.findByRole('alert', {
      name: 'Este contato foi alterado em outra sessão',
    });
    server.use(http.get(`${API}/contacts/:id`, () => new Response(null, { status: 500 })));

    await user.click(within(alert).getByRole('button', { name: 'Carregar versão atual' }));

    expect(
      await screen.findByText('Não foi possível carregar a versão atual. Tente novamente.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveValue(ACTIVE_OWNER);
  });

  it('telefone salvo aparece no campo e pode ser removido', async () => {
    const user = userEvent.setup();
    const contact = editElsewhere(ACTIVE_OWNER, { phone: '+558133330000' });
    renderRoute(`/contatos/${contact.id}/editar`);

    const phone = await screen.findByLabelText('Telefone (opcional)');
    expect(phone).toHaveValue('(81) 3333-0000');
    await user.clear(phone);
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await screen.findByRole('heading', { level: 1, name: ACTIVE_OWNER });
    expect(findContact(ACTIVE_OWNER).phone).toBeNull();
  });
});
