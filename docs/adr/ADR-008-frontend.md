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

### Acessibilidade (meta: WCAG 2.2 AA)

- Rótulos visíveis; `aria-invalid` + `aria-describedby`; no submit com erro, o foco vai para o resumo de erros.
- Favorito como `button` com `aria-pressed` e nome acessível contextual; status nunca indicado apenas por cor.
- Importação: `role="progressbar"` e região `aria-live="polite"` com anúncios espaçados (marcos, não cada atualização).
- Tabela semântica (`<caption>`, `scope`, `aria-sort`), skip link, foco visível, alvos ≥ 24 × 24 px (critério 2.5.8), contraste AA.
- Verificação automatizada: `eslint-plugin-jsx-a11y`, `vitest-axe` nos testes de componentes, axe nos e2e e Lighthouse CI. Verificação manual por teclado e leitor de tela nos fluxos críticos.

### Segurança

- Nenhum token acessível ao JavaScript (ADR-006). Wrapper de `fetch` único adiciona `X-Requested-With` e trata `401`.
- CSP estrita aplicada pela API ao servir o SPA (`@fastify/helmet`): `default-src 'self'`, sem scripts inline, `require-trusted-types-for 'script'`, `frame-ancestors 'none'`.
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
- **Component library própria:** custo alto para o prazo; Radix já resolve acessibilidade dos primitivos.

## Consequências

- (+) Menos código de otimização manual; regras de validação únicas; acessibilidade verificada continuamente.
- (+) Superfície de XSS reduzida (CSP + Trusted Types + ausência de tokens no JS).
- (−) Ecossistema TanStack (Router/Form) é menos conhecido por parte dos avaliadores. As escolhas ficam justificadas aqui.
- (−) Busca não é restaurada por link compartilhado (decisão de privacidade).
