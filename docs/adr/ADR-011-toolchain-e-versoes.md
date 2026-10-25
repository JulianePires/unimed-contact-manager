# ADR-011 — Toolchain e versões do repositório

- **Status:** Aceito
- **Data:** 2026-10-24
- **Relacionados:** ADR-007, ADR-008, ADR-010

## Contexto

A estrutura inicial do monorepo precisa fixar versões de runtime e ferramentas. Algumas versões mais recentes ainda não são compatíveis entre si (verificado nos `peerDependencies` em out/2026).

## Decisão

| Ferramenta   | Versão                                                              | Motivo                                                                                                        |
| ------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Node.js      | **24 LTS** (`>=24.15`)                                              | LTS ativo; exigido por `jsdom` 30 e compatível com Vitest 5                                                   |
| pnpm         | 10.28 (via `packageManager` + Corepack)                             | Workspaces, `deploy` e `onlyBuiltDependencies`                                                                |
| TypeScript   | **6.0**                                                             | `typescript-eslint` 8 suporta `<6.1`; TypeScript 7 (nativo) fica para quando o ecossistema de lint acompanhar |
| ESLint       | **9** (flat config única na raiz)                                   | `eslint-plugin-jsx-a11y` declara suporte até ESLint 9; acessibilidade no lint é requisito (ADR-008)           |
| Vite / React | 8 / 19.3, React Compiler 1.0 via `@rolldown/plugin-babel` + Babel 7 | Caminho estável do compilador; o modo Rust (`compiler: true`) ainda é experimental                            |
| Testes       | Vitest 5, Testing Library, MSW 3                                    | Um runner para back e front                                                                                   |
| Banco local  | PostgreSQL 18 (Compose)                                             | Mesma versão major disponível no Render                                                                       |

Outras decisões:

- **Versões fixadas (sem `^`)** e atualização assistida por Renovate, com agrupamentos.
- **Configurações compartilhadas em pacotes internos**: `@contatos/eslint-config` (presets `base`, `node`, `react`) e `@contatos/vitest-config` (presets `node`, `react`, `integration`), em JS sem build. Cada app/pacote tem o próprio `eslint.config.js` e `vitest.config.ts`; regras específicas ficam no consumidor (ex.: domínio sem I/O na API, ADR-007). O preset `react` proíbe `dangerouslySetInnerHTML`, `localStorage`, `sessionStorage` e `indexedDB` (ADR-008/009) e aplica `jsx-a11y` strict.
- **`packages/contracts` exporta TypeScript fonte**: o Vite consome direto e a API o embute no bundle (`tsup`, `noExternal`). Não há build intermediário.
- **Imagem Docker única** (API + SPA + worker + migrate), montada com `turbo prune` e `pnpm deploy --prod`, executando como usuário sem privilégios.
- **Biome como formatador** (JS/TS, JSON, CSS, Markdown, YAML) e **ESLint como linter**: o linter do Biome fica desligado; o ESLint cobre regras com tipos, `jsx-a11y` e restrições de arquitetura. `eslint-config-prettier` permanece para desligar regras de estilo do ESLint.
- **Finais de linha LF** forçados por `.gitattributes`/`.editorconfig`, para colaboração entre Windows e CI Linux.

## Consequências

- (+) Pipeline verde e reprodutível; versões verificadas como compatíveis.
- (−) ESLint 9 e TypeScript 6 não são as últimas majors. Revisar quando `jsx-a11y` e `typescript-eslint` ampliarem o suporte.
