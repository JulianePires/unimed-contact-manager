# ADR-007 — Arquitetura do backend e organização do repositório

- **Status:** Aceito
- **Data:** 2026-10-23
- **Relacionados:** ADR-001 a ADR-006

## Contexto

Backend em Node.js, API REST, PostgreSQL. As decisões anteriores exigem SQL avançado (`ON CONFLICT`, índices funcionais com `f_unaccent`, `UPDATE ... WHERE version`), transações compartilhadas com o pg-boss e validação consistente entre front e back. Prazo de 4 a 7 dias.

## Decisão

### Framework: Fastify

Validação e serialização por schema nativas, encapsulamento por plugins, bom suporte a TypeScript e geração de OpenAPI (`@fastify/swagger` + `fastify-type-provider-zod`).

### Monolito modular por feature

Módulos `auth`, `contacts` e `imports`, cada um com camadas finas:

```
rota (schema Zod, HTTP) → caso de uso (orquestra, transação) → repositório (Drizzle)
                                   ↓
                         domínio puro (sem I/O)
```

- **Domínio puro:** normalização e validação de telefone, validação de linha do CSV, transições de status, mapeamento de erros. 100% testável sem banco.
- **Porta/adaptador apenas onde há variação real:** a fila (`JobQueue`, implementada com pg-boss), o que permite testar casos de uso com uma fila em memória.
- Módulos não acessam repositórios uns dos outros; a comunicação passa por casos de uso.
- **Worker** é um segundo entrypoint do mesmo pacote (`src/worker.ts`), reutilizando os módulos.

### Monorepo (pnpm workspaces)

```
apps/
  api/        Fastify + worker
  web/        React + Vite
packages/
  contracts/  schemas Zod e tipos compartilhados (DTOs, códigos de erro)
```

Os schemas de `contracts` são a fonte única para validação na API, documentação OpenAPI e validação de formulários no front.

```
apps/api/src/
  modules/
    contacts/  domain/ use-cases/ repository.ts routes.ts
    imports/   domain/ use-cases/ repository.ts routes.ts jobs.ts
    auth/      ...
  shared/      db/ errors/ (Problem Details) http/ queue/ config/
  app.ts       server.ts    worker.ts
  db/migrations/
```

### Acesso a dados: Drizzle ORM

- Schema tipado em TypeScript, queries próximas do SQL.
- **Migrações versionadas**, com SQL escrito à mão quando necessário (extensões, `f_unaccent`, índices GIN, constraints), revisado como código.
- Transações explícitas nos casos de uso; o mesmo cliente transacional é repassado ao pg-boss (ADR-003).

### Configuração e erros

- Variáveis de ambiente validadas com Zod na inicialização (falha rápida).
- Handler central converte erros de domínio e violações do Postgres (`23505` → 409) em Problem Details (RFC 9457).
- Logs estruturados com `pino` (nativo do Fastify), incluindo `requestId`.

## Alternativas consideradas

- **Express:** ecossistema amplo, mas validação, tipagem e OpenAPI dependem de montagem manual.
- **Hexagonal completa:** portas para todos os recursos gerariam interfaces com implementação única. Custo de cerimônia maior que o benefício no escopo.
- **MVC em camadas globais:** mistura features e dificulta a evolução por módulo.
- **Prisma:** índices funcionais fora do schema e atrito para compartilhar transação com o pg-boss.
- **Kysely / SQL puro:** mais controle e menos abstração, mas Drizzle entrega tipagem e migrações com SQL customizado sem perder proximidade com o SQL.

## Consequências

- (+) Regras de negócio testáveis isoladamente; um contrato único entre front e back.
- (+) Estrutura que permite extrair um módulo (ex.: importação) para serviço próprio, se necessário.
- (−) Monorepo exige configuração inicial de workspaces, TypeScript project references e pipeline.
