# ADR-010 — Testes, integração contínua e deploy

- **Status:** Aceito
- **Data:** 2026-10-24
- **Relacionados:** ADR-001, ADR-002, ADR-003, ADR-006, ADR-007, ADR-008, ADR-011

## Contexto

O desafio exige testes unitários no backend e no frontend. As garantias mais críticas (unicidade sob concorrência e idempotência da importação) são implementadas pelo PostgreSQL e só podem ser provadas contra um banco real. A aplicação será publicada no **Render**, num monorepo orquestrado por **Turborepo** sobre pnpm workspaces.

Restrições do Render verificadas na documentação oficial (out/2026):

- No plano free, o web service hiberna após 15 min sem tráfego (cerca de 1 min para retomar); o Postgres free expira em 30 dias; background workers e _pre-deploy command_ não estão disponíveis.
- O Render Postgres suporta `pg_trgm`, `unaccent` e `citext`.
- Static Sites aceitam _rewrite_ para URL externa, mas a documentação não detalha o comportamento de proxy (headers e cookies).

## Decisão

### Testes

| Camada                      | Ferramentas                                                 | Escopo                                                                                                               |
| --------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Unitário (back)             | Vitest                                                      | Domínio puro: telefone, validação de linha CSV, transições de status, escape anti-CSV injection, mapeamento de erros |
| Integração (back)           | Vitest + **Testcontainers** (PostgreSQL) + `fastify.inject` | Constraints, `ON CONFLICT`, busca, _optimistic locking_, isolamento, jobs de importação                              |
| Unitário/componente (front) | Vitest + Testing Library + MSW + `vitest-axe`               | Comportamento de componentes e hooks                                                                                 |
| E2E                         | Playwright + `@axe-core/playwright`                         | Fluxos críticos sobre a stack completa (Docker Compose)                                                              |

Testes-âncora obrigatórios:

- 20 requisições simultâneas com o mesmo celular → exatamente 1 × `201` e 19 × `409`.
- Mesmo arquivo processado duas vezes → segunda execução com `created = 0` e `skipped = N`.

Detalhes em `docs/09-estrategia-de-testes.md`.

### Monorepo e build

- **Turborepo** orquestra `lint`, `typecheck`, `test`, `test:integration`, `build` e `e2e`, com grafo de dependências (`packages/contracts` → `apps/*`) e cache de tarefas.
- `apps/web` gera estáticos; `apps/api` os incorpora e serve via `@fastify/static`.

### CI (GitHub Actions)

`install (pnpm, cache) → lint → typecheck → test (unit) → test:integration (Testcontainers) → build → e2e (Compose + Playwright) → imagem Docker`

- Executado em todo PR; `main` protegida e exigindo pipeline verde.
- Relatórios de cobertura e do Playwright publicados como artefatos.
- Auditoria de dependências e atualização automatizada (Renovate ou Dependabot).

**Implementação** (`.github/workflows/ci.yml`): jobs paralelos `quality` (Biome, lint, typecheck), `test` (unitários; cobertura do front e de `contracts` publicada como artefato), `integration` (`test:coverage`: unitários + integração do backend com Testcontainers no Docker do runner, cobertura somada publicada como artefato) e `security` (`pnpm audit --audit-level=high` e gitleaks no histórico), e `versions` (commitlint, limite de 30 arquivos por commit com `check-commit-size.js` e `bump-versions.js --check`), seguidos de `build`. O workflow `pr-title.yml` valida o título do PR com o mesmo commitlint, porque no squash merge ele vira a mensagem do commit na `main`, e exige que o tipo do título corresponda ao maior bump entre os commits da branch (`bump-versions.js --check-title`). O job `CI ok` agrega todos e é o único check exigido na proteção da `main`. Actions fixadas por SHA (atualizadas pelo Renovate); setup comum em `.github/actions/setup`.

O job `docker` faz o build da imagem e um smoke test sobre o Compose (`/api/health/ready` e `/`). **Pendente:** e2e (Compose + Playwright) e Lighthouse CI entram junto com os testes E2E. O deploy não roda no GitHub Actions: o Blueprint usa `autoDeployTrigger: checksPass`, e o Render só faz deploy de um commit da `main` depois que os checks passam.

### Deploy (Render, declarado em `render.yaml`)

- **Web Service** (Docker): Fastify serve a **API em `/api`** e o **SPA em `/`** na mesma origem, com headers de segurança e CSP via `@fastify/helmet`, fallback de rotas do SPA para `index.html` e cache longo para assets com hash.
- **Background Worker**: mesma imagem, comando `node dist/worker.js` (`WORKER_MODE=standalone`).
- **Render Postgres** com as extensões necessárias.
- **Migrations**: `preDeployCommand` nos planos pagos; no modo free, executadas na inicialização sob `pg_advisory_lock`, evitando execução concorrente.
- **Health checks**: `/api/health/live` (processo) e `/api/health/ready` (banco acessível); deploy sem downtime.
- **Graceful shutdown**: ao receber `SIGTERM`, a API para de aceitar conexões e o worker conclui o lote corrente (`boss.stop({ graceful: true })`).
- Segredos e configuração por variáveis de ambiente (validadas com Zod).

### Modos de operação

| Ambiente                | Worker       | Migrations                         | Observação                                   |
| ----------------------- | ------------ | ---------------------------------- | -------------------------------------------- |
| Local (Compose)         | `standalone` | serviço `migrate` one-off          | Paridade com produção                        |
| Render pago (avaliação) | `standalone` | `preDeployCommand`                 | Topologia de referência                      |
| Render free             | `embedded`   | na inicialização com advisory lock | Cold start e expiração do banco documentados |

## Alternativas consideradas

- **Static Site + rewrite `/api`:** CDN para o front, mas a passagem de cookies pelo rewrite não está documentada; arriscado para a autenticação por sessão.
- **VM com Docker Compose + Caddy:** paridade total, mas exige operação da máquina.
- **Fly.io / AWS ECS:** viáveis; o Render reduz operação e oferece Blueprint declarativo.
- **Mocks de repositório para testar unicidade:** não exercitam a constraint real. Rejeitado.

## Consequências

- (+) Garantias críticas provadas automaticamente contra PostgreSQL real.
- (+) Mesma origem por construção, sem dependência de proxy da plataforma.
- (+) Infraestrutura como código e deploy sem downtime.
- (−) O SPA não é servido por CDN; aceitável para o escopo, com cache HTTP agressivo nos assets.
- (−) Testcontainers exige Docker no ambiente de CI e no ambiente local de quem roda os testes de integração.
- (−) Custo mensal dos planos pagos durante o período de avaliação.
