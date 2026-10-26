import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/test/axe';
import { findContact, setContacts } from '@/test/msw/contacts';
import { API, problem } from '@/test/msw/handlers';
import { server } from '@/test/msw/server';
import { renderRoute } from '@/test/render';

type User = ReturnType<typeof userEvent.setup>;

/** Registra a query string de cada GET /contacts e deixa o handler padrão responder. */
function recordListRequests() {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get(`${API}/contacts`, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
    }),
  );
  return requests;
}

async function openList(path = '/contatos') {
  const result = renderRoute(path);
  await screen.findByRole('table');
  return result;
}

function rowNames(): string[] {
  return screen.getAllByRole('rowheader').map((cell) => cell.textContent);
}

async function choose(user: User, label: string, option: string) {
  screen.getByRole('combobox', { name: label }).focus();
  await user.keyboard('{Enter}');
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Lista de contatos (RF06)', () => {
  it('mostra os ativos em ordem alfabética, em tabela semântica', async () => {
    await openList();

    const table = screen.getByRole('table', { name: 'Contatos, ordenados por nome (a–z)' });
    expect(within(table).getAllByRole('row')).toHaveLength(21);
    expect(rowNames().slice(0, 3)).toEqual(['Ana Beatriz Lima', 'André Costa', 'Bruno Araújo']);
    expect(screen.getByRole('columnheader', { name: 'Nome' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: 'Cadastrado em' })).toHaveAttribute(
      'aria-sort',
      'none',
    );
    const row = screen.getByRole('row', { name: /André Costa/ });
    expect(within(row).getByText('andre.costa@empresa.com')).toBeInTheDocument();
    expect(within(row).getByText('(81) 99990-0001')).toBeInTheDocument();
    expect(within(row).getByText('Ativo')).toBeInTheDocument();
    expect(within(row).getByText('02/10/2026')).toBeInTheDocument();
  });

  it('a tabela fica numa região rolável e focável pelo teclado', async () => {
    await openList();

    const region = screen.getByRole('region', { name: 'Contatos, ordenados por nome (a–z)' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('overflow-x-auto');
  });

  it('anuncia a quantidade de resultados', async () => {
    await openList();

    expect(await screen.findByRole('status')).toHaveTextContent('20 contatos encontrados');
  });

  it('não tem violações de acessibilidade com dados', async () => {
    await openList();

    await expectNoAxeViolations(document.body);
  });
});

describe('Busca (RF07, RN16)', () => {
  it('busca uma vez após a digitação, sem colocar o termo na URL', async () => {
    const user = userEvent.setup();
    const requests = recordListRequests();
    const { router } = await openList('/contatos?page=1');

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'joao');

    await waitFor(() => {
      expect(rowNames()).toEqual(['João Souza']);
    });
    const searches = requests.filter((params) => params.has('q'));
    expect(searches.map((params) => params.get('q'))).toEqual(['joao']);
    expect(router.state.location.search).toEqual({});
    expect(router.state.location.href).not.toContain('joao');
    expect(await screen.findByRole('status')).toHaveTextContent('1 contato encontrado');
  });

  it('descarta q vindo na URL', async () => {
    const requests = recordListRequests();
    const { router } = await openList('/contatos?q=ana');

    expect(router.state.location.search).toEqual({});
    expect(requests.every((params) => !params.has('q'))).toBe(true);
  });

  it('volta à primeira página quando o termo muda', async () => {
    const user = userEvent.setup();
    const { router } = await openList('/contatos?pageSize=10&page=2');

    await user.type(screen.getByRole('searchbox', { name: 'Buscar' }), 'ma{Enter}');

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ pageSize: 10 });
    });
  });

  it('busca sem resultado oferece limpar busca e filtros', async () => {
    const user = userEvent.setup();
    const { router } = await openList('/contatos?status=inactive');
    const searchbox = screen.getByRole('searchbox', { name: 'Buscar' });

    await user.type(searchbox, 'zzz');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Nenhum contato encontrado' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Nada corresponde a “zzz” com os filtros atuais.')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent('0 contatos encontrados');
    await expectNoAxeViolations(document.body);

    await user.click(screen.getByRole('button', { name: 'Limpar busca e filtros' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(searchbox).toHaveValue('');
    expect(router.state.location.search).toEqual({});
  });
});

describe('Filtros, ordenação e paginação na URL (RF06, RF08)', () => {
  it('status vai para a URL e filtra a lista', async () => {
    const user = userEvent.setup();
    const { router } = await openList();

    await choose(user, 'Status', 'Inativos');

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ status: 'inactive' });
    });
    await waitFor(() => {
      expect(rowNames()).toEqual([
        'Carlos Eduardo Melo',
        'Helena Barros',
        'Lucas Ribeiro',
        'Paula Cristina',
        'Vítor Hugo',
      ]);
    });
    expect(screen.getAllByText('Inativo')).toHaveLength(5);
  });

  it('"Só favoritos" é um botão alternável refletido na URL', async () => {
    const user = userEvent.setup();
    const { router } = await openList();
    const toggle = screen.getByRole('button', { name: 'Só favoritos' });

    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(router.state.location.search).toEqual({ favorite: true });
    await waitFor(() => {
      expect(rowNames()).toEqual([
        'Ana Beatriz Lima',
        'Gabriel Nunes',
        'João Souza',
        'Marcos Vinícius',
        'Rafael Monteiro',
      ]);
    });

    await user.click(toggle);

    expect(router.state.location.search).toEqual({});
  });

  it('ordenação pelo seletor e pelo cabeçalho atualiza aria-sort e a URL', async () => {
    const user = userEvent.setup();
    const { router } = await openList();

    await choose(user, 'Ordenar por', 'Mais recentes');

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Cadastrado em' })).toHaveAttribute(
        'aria-sort',
        'descending',
      );
    });
    expect(router.state.location.search).toEqual({ sort: '-createdAt' });
    expect(rowNames()[0]).toBe('Tatiane Lopes');

    await user.click(screen.getByRole('button', { name: 'Nome' }));
    await user.click(screen.getByRole('button', { name: 'Nome' }));

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Nome' })).toHaveAttribute(
        'aria-sort',
        'descending',
      );
    });
    expect(router.state.location.search).toEqual({ sort: '-name' });
    expect(rowNames()[0]).toBe('Tatiane Lopes');

    await user.click(screen.getByRole('button', { name: 'Cadastrado em' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ sort: '-createdAt' });
    });
    await user.click(screen.getByRole('button', { name: 'Cadastrado em' }));
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ sort: 'createdAt' });
    });
  });

  it('paginação e tamanho de página vão para a URL', async () => {
    const user = userEvent.setup();
    const { router } = await openList();

    await choose(user, 'Por página', '10');

    await waitFor(() => {
      expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    });
    expect(router.state.location.search).toEqual({ pageSize: 10 });
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Próxima' }));

    await waitFor(() => {
      expect(screen.getByText('Página 2 de 2')).toBeInTheDocument();
    });
    expect(router.state.location.search).toEqual({ pageSize: 10, page: 2 });
    expect(rowNames()[0]).toBe('João Souza');
    expect(screen.getByRole('button', { name: 'Próxima' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Anterior' }));

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ pageSize: 10 });
    });
  });

  it('recarregar a URL restaura filtros e página', async () => {
    const requests = recordListRequests();
    await openList('/contatos?status=all&favorite=true&sort=%22-name%22&pageSize=2&page=2');

    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Todos');
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveTextContent('Nome (Z–A)');
    expect(screen.getByRole('button', { name: 'Só favoritos' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Página 2 de 4')).toBeInTheDocument();
    expect(Object.fromEntries(requests.at(-1) ?? [])).toEqual({
      page: '2',
      pageSize: '2',
      status: 'all',
      favorite: 'true',
      sort: '-name',
    });
  });

  it('valores inválidos na URL voltam ao padrão', async () => {
    const { router } = await openList('/contatos?status=x&page=-3&pageSize=500&sort=idade');

    expect(router.state.location.search).toEqual({});
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent('Ativos');
  });
});

describe('Favorito otimista (RF13)', () => {
  it('marca na hora e mantém após a confirmação da API', async () => {
    const user = userEvent.setup();
    let respond: () => void = () => undefined;
    server.use(
      http.put(
        `${API}/contacts/:id/favorite`,
        () =>
          new Promise<undefined>((resolve) => {
            respond = () => {
              resolve(undefined);
            };
          }),
      ),
    );
    await openList();
    const star = screen.getByRole('button', { name: 'Favoritar André Costa' });
    expect(star).toHaveAttribute('aria-pressed', 'false');

    await user.click(star);

    expect(star).toHaveAttribute('aria-pressed', 'true');
    respond();
    await waitFor(() => {
      expect(findContact('André Costa').isFavorite).toBe(true);
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Favoritar André Costa' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  it('desfavorita com DELETE', async () => {
    const user = userEvent.setup();
    await openList();

    await user.click(screen.getByRole('button', { name: 'Favoritar Ana Beatriz Lima' }));

    await waitFor(() => {
      expect(findContact('Ana Beatriz Lima').isFavorite).toBe(false);
    });
    expect(screen.getByRole('button', { name: 'Favoritar Ana Beatriz Lima' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('volta ao estado anterior e avisa quando a API falha', async () => {
    const user = userEvent.setup();
    server.use(
      http.put(`${API}/contacts/:id/favorite`, () => problem('INTERNAL_ERROR', 'Erro interno')),
    );
    await openList();
    const star = screen.getByRole('button', { name: 'Favoritar André Costa' });

    await user.click(star);

    expect(
      await screen.findByText('Não foi possível favoritar André Costa. Tente novamente.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(star).toHaveAttribute('aria-pressed', 'false');
    });
    expect(findContact('André Costa').isFavorite).toBe(false);
  });
});

describe('Estados da lista', () => {
  it('agenda vazia convida a importar', async () => {
    setContacts([]);
    renderRoute('/contatos');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Sua agenda ainda está vazia' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Importar contatos' })).toHaveAttribute(
      'href',
      '/importacoes',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await expectNoAxeViolations(document.body);
  });

  it('falha ao carregar mostra alerta e permite tentar de novo', async () => {
    const user = userEvent.setup();
    server.use(http.get(`${API}/contacts`, () => problem('INTERNAL_ERROR', 'Erro interno')));
    renderRoute('/contatos');

    expect(
      await screen.findByText('Não foi possível carregar os contatos.', {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Contatos' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    await expectNoAxeViolations(document.body);

    server.resetHandlers();
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});
