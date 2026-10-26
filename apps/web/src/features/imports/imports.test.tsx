import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { expectNoAxeViolations } from '@/test/axe';
import { API, problem } from '@/test/msw/handlers';
import { findImport } from '@/test/msw/imports';
import { server } from '@/test/msw/server';
import { renderRoute } from '@/test/render';

import { IMPORT_POLL_INTERVAL_MS } from './api';

type User = ReturnType<typeof userEvent.setup>;

const DROPZONE = /Arraste o arquivo CSV até aqui/;

function csv(name: string, content = `nome;email;celular\n${name};a@b.com;81999990000`) {
  return new File([content], name, { type: 'text/csv' });
}

function setupUser(options: { applyAccept?: boolean } = {}) {
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms), ...options });
}

/** Um ciclo do polling (2 s) e a resposta da API. */
async function nextPoll() {
  await act(() => vi.advanceTimersByTimeAsync(IMPORT_POLL_INTERVAL_MS));
}

/** Conta as consultas de uma importação, deixando o handler padrão responder. */
function countImportGets() {
  const ids: string[] = [];
  server.use(
    http.get(`${API}/imports/:id`, ({ params }) => {
      ids.push(String(params['id']));
    }),
  );
  return ids;
}

async function uploadFrom(user: User, file: File) {
  await user.upload(await screen.findByLabelText(DROPZONE), file);
}

beforeEach(() => {
  // Só os timers do polling: falsificar setImmediate trava os streams do Node (corpo das requisições)
  vi.useFakeTimers({
    shouldAdvanceTime: true,
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Importações: envio (RF15, UC12)', () => {
  it('mostra área de envio acessível, CSV modelo e histórico', async () => {
    renderRoute('/importacoes');

    const input = await screen.findByLabelText(DROPZONE);
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', '.csv,text/csv');
    expect(input).toHaveAccessibleDescription(/Até 5 MB/);
    expect(screen.getByRole('link', { name: 'Baixar CSV modelo' })).toHaveAttribute(
      'href',
      '/api/v1/imports/template.csv',
    );
    const table = await screen.findByRole('table', {
      name: 'Importações, das mais recentes para as mais antigas',
    });
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((cell) => cell.textContent),
    ).toEqual(['planilha-errada.csv', 'fornecedores.csv', 'clientes-setembro.csv']);
    expect(within(table).getByText('Concluída com erros')).toBeInTheDocument();
    expect(within(table).getByText('Falhou')).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('sem importações, o histórico convida a enviar o primeiro arquivo', async () => {
    server.use(
      http.get(`${API}/imports`, () =>
        Response.json({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } }),
      ),
    );
    renderRoute('/importacoes');

    expect(
      await screen.findByText(
        'Nenhuma importação ainda. Envie um arquivo CSV para trazer seus contatos.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('a página do histórico vai para a URL', async () => {
    const user = setupUser();
    const pages: (string | null)[] = [];
    server.use(
      http.get(`${API}/imports`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page');
        pages.push(page);
        return Response.json({
          data: [findImport('clientes-setembro.csv').item],
          meta: { page: Number(page), pageSize: 20, total: 25, totalPages: 2 },
        });
      }),
    );
    const { router } = renderRoute('/importacoes');

    await user.click(await screen.findByRole('button', { name: 'Próxima' }));

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ page: 2 });
    });
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(pages).toContain('2');
  });

  it.each([
    ['extensão diferente de .csv', csv('contatos.xlsx'), 'Envie um arquivo no formato CSV (.csv).'],
    [
      'arquivo acima de 5 MB',
      csv('grande.csv', 'x'.repeat(5 * 1024 * 1024 + 1)),
      'O arquivo passa do limite de 5 MB.',
    ],
  ])('recusa no cliente: %s', async (_, file, message) => {
    // Sem aplicar o `accept`, como ao arrastar um arquivo qualquer até a área
    const user = setupUser({ applyAccept: false });
    const posts: unknown[] = [];
    server.use(
      http.post(`${API}/imports`, () => {
        posts.push(true);
      }),
    );
    renderRoute('/importacoes');

    await uploadFrom(user, file);

    expect(await screen.findByText(message)).toHaveAttribute('role', 'alert');
    expect(screen.getByLabelText(DROPZONE)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(DROPZONE)).toHaveAccessibleDescription(
      expect.stringContaining(message),
    );
    expect(posts).toHaveLength(0);
  });

  it.each([
    ['413', problem('FILE_TOO_LARGE', 'Arquivo grande'), 'O arquivo passa do limite de 5 MB.'],
    ['415', problem('UNSUPPORTED_FILE_TYPE', 'Tipo'), 'Envie um arquivo no formato CSV.'],
    [
      '500',
      problem('INTERNAL_ERROR', 'Erro'),
      'Não foi possível enviar o arquivo. Tente novamente em instantes.',
    ],
  ])('mostra o erro %s da API sem detalhes técnicos', async (_, response, message) => {
    const user = setupUser();
    server.use(http.post(`${API}/imports`, () => response));
    renderRoute('/importacoes');

    await uploadFrom(user, csv('contatos.csv'));

    expect(await screen.findByText(message)).toHaveAttribute('role', 'alert');
  });
});

describe('Acompanhamento (RF16, RF17, UC13)', () => {
  it('202 → polling → COMPLETED_WITH_ERRORS, com marcos anunciados e polling encerrado', async () => {
    const user = setupUser();
    const gets = countImportGets();
    const { router } = renderRoute('/importacoes');

    await uploadFrom(user, csv('contatos-com-erros.csv'));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'contatos-com-erros.csv' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/importacoes\/[0-9a-f-]{36}$/);
    expect(screen.getByText('Na fila')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'Progresso' });
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(bar).toHaveAttribute('aria-valuetext', 'Aguardando o início do processamento');
    expect(screen.getByRole('link', { name: /Importações\s*processando/ })).toBeInTheDocument();

    await nextPoll();
    expect(await screen.findByText('Processando')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Importação em processamento.');

    await nextPoll();
    await waitFor(() => {
      expect(bar).toHaveAttribute('aria-valuenow', '40');
    });
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuetext', '40 de 100 linhas');
    expect(screen.getByRole('status')).toHaveTextContent('Importação em 40%.');

    await nextPoll();
    expect(await screen.findByText('Concluída com erros')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Importação concluída com erros: 70 contatos criados, 5 ignorados, 25 com erro.',
    );
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    const counters = screen.getByText('Criados').closest('dl');
    expect(counters).toHaveTextContent('Criados70Ignorados5Com erro25');

    const polls = gets.length;
    await nextPoll();
    await nextPoll();
    expect(gets).toHaveLength(polls);
    await waitFor(() => {
      expect(screen.queryByText('processando')).not.toBeInTheDocument();
    });
    await expectNoAxeViolations(document.body);
  });

  it('linhas com erro: tabela paginada na URL e download do CSV', async () => {
    const user = setupUser();
    const { router } = renderRoute('/importacoes');
    await uploadFrom(user, csv('lote-com-erros.csv'));
    await screen.findByRole('heading', { level: 1, name: 'lote-com-erros.csv' });
    await nextPoll();
    await nextPoll();
    await nextPoll();

    const table = await screen.findByRole('table', { name: 'Linhas com erro e seus motivos' });
    expect(within(table).getAllByRole('rowheader')).toHaveLength(20);
    expect(within(table).getAllByText('Informe um e-mail válido.')).toHaveLength(20);
    expect(within(table).getAllByText('Pessoa 1')[0]).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Baixar linhas com erro (CSV)' })).toHaveAttribute(
      'href',
      `/api/v1/imports/${router.state.location.pathname.split('/').at(-1) ?? ''}/errors.csv`,
    );
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() => {
      expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    });
    expect(router.state.location.search).toEqual({ errorsPage: 2 });
    expect(
      within(screen.getByRole('table', { name: 'Linhas com erro e seus motivos' })).getAllByRole(
        'rowheader',
      )[0],
    ).toHaveTextContent('22');
    await expectNoAxeViolations(document.body);
  });

  it('FAILED: alerta com o motivo, anúncio assertivo e sem tabela de erros', async () => {
    const user = setupUser();
    renderRoute('/importacoes');

    await uploadFrom(user, csv('falha-cabecalho.csv'));
    await screen.findByRole('heading', { level: 1, name: 'falha-cabecalho.csv' });
    await nextPoll();
    await nextPoll();

    expect(
      await screen.findByRole('heading', { level: 2, name: 'A importação falhou' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Cabeçalho sem a coluna obrigatória "email"/)).toBeInTheDocument();
    expect(screen.getByText('Falhou')).toBeInTheDocument();
    expect(screen.getByText('A importação falhou.').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'assertive',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('importação já terminada não faz polling nem anuncia ao abrir', async () => {
    const gets = countImportGets();
    renderRoute(`/importacoes/${findImport('fornecedores.csv').item.id}`);

    await screen.findByRole('heading', { level: 1, name: 'fornecedores.csv' });
    const initial = gets.length;
    const announced = screen.getByRole('status').textContent;
    await nextPoll();
    await nextPoll();

    expect(gets).toHaveLength(initial);
    expect(screen.getByRole('status')).toHaveTextContent(announced);
  });
});

describe('Arquivo duplicado (RF22, ADR-002)', () => {
  it('409 abre o aviso; "Ver importação anterior" leva a ela', async () => {
    const user = setupUser();
    const previous = findImport('clientes-setembro.csv');
    const { router } = renderRoute('/importacoes');

    await uploadFrom(user, csv('copia.csv', previous.content));

    const dialog = await screen.findByRole('dialog', { name: 'Este arquivo já foi importado' });
    expect(dialog).toHaveTextContent(/“copia\.csv” foi importado em 11\/10\/2026/);
    await expectNoAxeViolations(document.body);

    await user.click(within(dialog).getByRole('button', { name: 'Ver importação anterior' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'clientes-setembro.csv' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/importacoes/${previous.item.id}`);
  });

  it('"Importar novamente" reenvia com force=true', async () => {
    const user = setupUser();
    const forced: (string | null)[] = [];
    server.use(
      http.post(`${API}/imports`, ({ request }) => {
        forced.push(new URL(request.url).searchParams.get('force'));
      }),
    );
    renderRoute('/importacoes');

    await uploadFrom(user, csv('copia.csv', findImport('clientes-setembro.csv').content));
    const dialog = await screen.findByRole('dialog', { name: 'Este arquivo já foi importado' });
    await user.click(within(dialog).getByRole('button', { name: 'Importar novamente' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'copia.csv' })).toBeInTheDocument();
    expect(forced).toEqual([null, 'true']);
  });

  it('fechar o aviso não envia nada e volta ao envio', async () => {
    const user = setupUser();
    renderRoute('/importacoes');

    await uploadFrom(user, csv('copia.csv', findImport('clientes-setembro.csv').content));
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Importações' })).toBeInTheDocument();
  });
});

describe('Excluir e não encontrada (RF23)', () => {
  it('exclui após confirmação e volta ao histórico', async () => {
    const user = setupUser();
    const target = findImport('fornecedores.csv').item;
    const { router } = renderRoute(`/importacoes/${target.id}`);

    await user.click(await screen.findByRole('button', { name: 'Excluir importação' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Excluir esta importação?' });
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Excluir importação' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Importações' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/importacoes');
    expect(await screen.findByText('Importação excluída.')).toBeInTheDocument();
    expect(() => findImport('fornecedores.csv')).toThrow();
  });

  it('falha ao excluir avisa e mantém o diálogo', async () => {
    const user = setupUser();
    server.use(http.delete(`${API}/imports/:id`, () => problem('INTERNAL_ERROR', 'Erro')));
    renderRoute(`/importacoes/${findImport('fornecedores.csv').item.id}`);

    await user.click(await screen.findByRole('button', { name: 'Excluir importação' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Excluir importação' }));

    expect(
      await screen.findByText('Não foi possível excluir a importação. Tente novamente.'),
    ).toBeInTheDocument();
  });

  it.each([
    ['id inexistente', '/importacoes/0192f3a1-0000-7000-9000-999999999999'],
    ['id inválido', '/importacoes/abc'],
  ])('%s mostra "Importação não encontrada"', async (_, path) => {
    renderRoute(path);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Importação não encontrada' }),
    ).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('outras falhas da API vão para a tela de erro', async () => {
    server.use(http.get(`${API}/imports/:id`, () => problem('INTERNAL_ERROR', 'Erro')));
    renderRoute(`/importacoes/${findImport('fornecedores.csv').item.id}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Algo deu errado' }),
    ).toBeInTheDocument();
  });
});
