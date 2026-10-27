# ADR-008 — Arquitetura do frontend

- **Status:** Aceito
- **Data:** 2026-10-23
- **Relacionados:** ADR-004, ADR-006, ADR-007, ADR-009

## Contexto

Frontend em React com Vite, consumindo a API REST no mesmo domínio. Requisitos de qualidade: acessibilidade, segurança, conformidade com a LGPD, testes unitários e uso dos recursos de otimização das versões atuais do React.

Versões de referência (out/2026): React 19.3, React Compiler 1.0, Vite 8 (Rolldown), `@vitejs/plugin-react` v6.

## Decisão

### Stack

| Preocupação        | Escolha                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Build              | Vite 8 + `@vitejs/plugin-react` v6 com `reactCompilerPreset`                                  |
| Estado do servidor | TanStack Query                                                                                |
| Roteamento         | TanStack Router, com search params validados por Zod                                          |
| Formulários        | TanStack Form + schemas Zod de `packages/contracts`                                           |
| Tabelas            | TanStack Table v9 (headless), com ordenação e paginação feitas pela API                       |
| UI                 | shadcn/ui (primitivos Radix) + Tailwind CSS v4                                                |
| Testes             | Vitest, Testing Library, `user-event`, MSW, `vitest-axe`; Playwright + `@axe-core/playwright` |

### Estado

- **Sem store global.** Dados do servidor ficam no cache do TanStack Query; filtros não sensíveis na URL; estado efêmero local.
- **URL:** `page`, `pageSize`, `status`, `favorite`, `sort`, tipados e validados no router. O termo de busca `q` **não** vai para a URL (ADR-009).
- Sessão via query `/auth/me`. No logout, `queryClient.clear()`.

### Recursos do React aplicados

- **React Compiler:** memoização automática; `useMemo`/`useCallback`/`memo` manuais não são usados, salvo exceção justificada. Lint do compilador ativo em `eslint-plugin-react-hooks`.
- **`useOptimistic`:** favoritar com atualização instantânea e rollback automático em caso de falha, seguido de invalidação da query.
- **`useDeferredValue` + debounce (300 ms):** input de busca responsivo e menos requisições.
- **`<Activity>`:** abas "Contatos" e "Importações" preservam estado quando ocultas; os effects (incluindo o polling) são desmontados enquanto ocultas.
- **`useEffectEvent`:** callbacks de polling e de anúncios acessíveis leem o estado atual sem reiniciar o intervalo.
- **`<ViewTransition>`:** transição entre lista e detalhe, desativada sob `prefers-reduced-motion`.
- **Fragment refs:** gestão de foco em grupos de campos e diálogos.
- **`<title>` por rota:** anuncia a mudança de página a leitores de tela.
- **Suspense + Error Boundaries** com `useSuspenseQuery`; lazy loading por rota.

### Formulários

TanStack Form com validação por Zod (Standard Schema) dos `contracts`: a mesma regra roda no cliente e na API. Erros da API (Problem Details) são mapeados para os campos pelo `code`/`errors[]`. O conflito `MOBILE_BELONGS_TO_INACTIVE_CONTACT` oferece a ação "Reativar contato". Um `412` na edição exibe aviso de alteração concorrente com opção de recarregar.

### Tabelas de listagem

As listagens (contatos, histórico e erros de importação) são compostas com **TanStack Table v9**, que é _headless_: descreve colunas e estado (ordenação, paginação), e a marcação continua sendo dos componentes shadcn/ui.

- **Dados do servidor:** `manualSorting` e `manualPagination`. A API entrega a página já ordenada (`sort`, `page`, `pageSize`, `rowCount = meta.total`); a tabela não reordena nem fatia linhas no cliente.
- **Estado na URL:** `sorting` e `pagination` são estado controlado, derivado dos search params. Cliques no cabeçalho e na paginação viram navegação; o cache do TanStack Query continua sendo a única cópia dos dados.
- **Componente genérico** (`components/data-table/`): `DataTable` gera `<caption>`, `th scope="col"`, `aria-sort` com botão nas colunas ordenáveis e `th scope="row"` na coluna marcada com `meta.rowHeader`, dentro de uma região de rolagem horizontal focável. `DataTablePagination` usa a API de paginação da tabela. Cada feature só declara colunas.
- **Funcionalidades registradas explicitamente** (`tableFeatures({ rowSortingFeature, rowPaginationFeature })`), sem `stockFeatures`, para não levar ao bundle o que não é usado.

### Acessibilidade (meta: WCAG 2.2 AA)

- Rótulos visíveis; `aria-invalid` + `aria-describedby`; no submit com erro, o foco vai para o resumo de erros.
- Favorito como `button` com `aria-pressed` e nome acessível contextual; status nunca indicado apenas por cor.
- Importação: `role="progressbar"` e região `aria-live="polite"` com anúncios espaçados (marcos, não cada atualização).
- Tabela semântica (`<caption>`, `scope`, `aria-sort`), skip link, foco visível, alvos ≥ 24 × 24 px (critério 2.5.8), contraste AA.
- Verificação automatizada: `eslint-plugin-jsx-a11y`, `vitest-axe` nos testes de componentes, axe nos e2e e Lighthouse CI. Verificação manual por teclado e leitor de tela nos fluxos críticos.

### Segurança

- Nenhum token acessível ao JavaScript (ADR-006). Wrapper de `fetch` único adiciona `X-Requested-With` e trata `401`.
- CSP estrita aplicada pela API (`@fastify/helmet`) em todas as respostas: `default-src 'self'`, `script-src 'self'` (sem scripts inline), `style-src 'self'` com **nonce por resposta** (sem `unsafe-inline`), `require-trusted-types-for 'script'` com uma única política (`trusted-types default`), `object-src 'none'`, `frame-ancestors 'none'`. O que isso exige do front:
  - o nonce de estilo chega por `<meta name="csp-nonce">` (a API troca o marcador do `index.html` a cada resposta) e é registrado no `get-nonce`, usado pelos `<style>` que o Radix injeta (bloqueio de rolagem e viewport do Select);
  - a política `default` dos Trusted Types libera só o HTML fixo do `<style>` do Radix Select; qualquer outra escrita em `innerHTML` é bloqueada;
  - o Zod roda sem JIT (`jitless`), que usaria `new Function`; o build preserva a ordem de execução dos módulos (`strictExecutionOrder`) para essa configuração valer antes dos schemas;
  - o CSS do sonner é importado estaticamente; a cópia que ele injeta em tempo de execução é bloqueada pela CSP (aviso no console, sem efeito visual).
- Demais headers: HSTS de 2 anos e `upgrade-insecure-requests` em produção, `Referrer-Policy: no-referrer`, `Permissions-Policy` desligando câmera, microfone, geolocalização, pagamento e sensores. O `/api/docs` (só fora de produção) usa a CSP própria do Swagger UI.
- Proibido `dangerouslySetInnerHTML` (regra de lint).
- Upload: validação de tipo e tamanho no cliente apenas como UX; a API é a autoridade.
- Dependências com lockfile, auditoria no CI e atualização automatizada.

### Testes

- **Unitários e de componente** focados em comportamento observável pelo usuário. A API é mockada na camada de rede (MSW) com fixtures tipadas pelos `contracts`.
- **E2E (Playwright)** apenas nos fluxos críticos: autenticação, cadastro com conflito de celular e importação com erros.
- **Gate no CI:** `tsc` em modo strict, ESLint (typescript-eslint strict, react-hooks, jsx-a11y), testes com cobertura mínima, axe e orçamento do Lighthouse.

## Alternativas consideradas

- **Redux/Zustand:** duplicariam o estado do servidor; desnecessários.
- **Actions nativas (`useActionState`):** menos dependências, mas validação por campo e estado de formulário mais limitados que no TanStack Form.
- **React Hook Form:** maduro, porém o TanStack Form oferece tipagem mais forte e coerência com o restante do ecossistema TanStack.
- **React Router v7:** mais difundido, mas sem search params tipados nativamente.
- **Tabelas escritas à mão (sem biblioteca):** suficientes para uma única lista, mas repetiriam em cada listagem o mapeamento de ordenação, paginação e semântica (`aria-sort`, `scope`). O TanStack Table concentra isso e mantém a coerência com o ecossistema TanStack.
- **AG Grid / MUI DataGrid:** prontos, porém impõem a própria marcação e estilos (conflitando com shadcn/ui e os tokens validados de contraste) e têm bundle bem maior.
- **Component library própria:** custo alto para o prazo; Radix já resolve acessibilidade dos primitivos.

## Consequências

- (+) Menos código de otimização manual; regras de validação únicas; acessibilidade verificada continuamente.
- (+) Superfície de XSS reduzida (CSP + Trusted Types + ausência de tokens no JS).
- (−) Ecossistema TanStack (Router/Form/Table) é menos conhecido por parte dos avaliadores. As escolhas ficam justificadas aqui.
- (−) TanStack Table v9 é uma versão recente (API com `tableFeatures`/`useTable`, diferente da v8); exemplos antigos da comunidade não se aplicam diretamente.
- (−) Busca não é restaurada por link compartilhado (decisão de privacidade).

## Atualização (2026-10-27)

**Recursos do React não implementados:**

- **`<Activity>`:** as abas Contatos e Importações são rotas comuns. Ao sair de uma aba, o estado da página não é preservado, e o polling para porque a query fica sem observadores.
- **`<ViewTransition>`:** não há transição animada entre a lista e o detalhe.
- **Fragment refs:** o foco é gerenciado com refs comuns (`ErrorSummary`, `InactiveConflictAlert`, título após inativar) e pelos diálogos do Radix.

**Implementados como descrito:** React Compiler, `useOptimistic` (favorito), `useDeferredValue` + debounce (busca), `useEffectEvent` (anúncios da importação), `<title>` por rota, Suspense com `useSuspenseQuery` e divisão de código por rota (`autoCodeSplitting` do TanStack Router).

**Demais divergências:**

- **Formulários:** o envio revalida os valores atuais antes do `handleSubmit` (`submitForm` em `lib/form.ts`). Sem isso, Enter no último campo, sem sair dele, era bloqueado pelo erro "vazio" gravado ao sair do campo anterior.
- **E2E:** são 5 cenários (autenticação, conflito com inativo, importação, fluxo só com teclado e isolamento), rodando em Chromium, Firefox, WebKit e viewport móvel, com axe em cada tela. O cenário só com teclado é pulado no WebKit, que, como o Safari padrão, não foca links com Tab.
- **Lighthouse CI:** só Acessibilidade (≥ 95) bloqueia; Performance e Boas práticas geram aviso. A medição local deu Performance de 71 a 81 e Boas práticas 93, abaixo das metas ([09 §9.8](../09-estrategia-de-testes.md#98-resultados-medidos)).
- **Verificação manual:** a navegação por teclado é coberta pelo T-E2E04. Não há registro de verificação com leitor de tela.
