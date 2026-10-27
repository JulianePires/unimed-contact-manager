# 3. Arquitetura

Visão em camadas segundo o modelo **C4** (contexto → containers → componentes), complementada pelo modelo de dados e pela visão de implantação. As decisões que justificam cada elemento estão nos [ADRs](adr/README.md).

## 3.1 Princípios

1. **O banco garante invariantes; a aplicação as traduz.** Unicidade, idempotência e concorrência são resolvidas por constraints e transações do PostgreSQL (ADR-001/002/003).
2. **Uma única infraestrutura de estado.** Dados, fila, sessões e arquivos temporários ficam no PostgreSQL, evitando _dual write_ (ADR-003/006).
3. **Domínio puro, bordas finas.** Regras sem I/O e testáveis isoladamente; HTTP, banco e fila nas bordas (ADR-007).
4. **Contrato único.** Schemas Zod compartilhados entre API, OpenAPI e formulários (ADR-007/008).
5. **Privacidade por padrão.** Minimização, retenção e eliminação desde o desenho (ADR-009).

## 3.2 Nível 1 — Contexto

```mermaid
flowchart TB
  user(["👤 Usuário<br/><i>Pessoa que gerencia<br/>sua agenda de contatos</i>"])
  sys["<b>Gerenciador de Contatos</b><br/>Cadastro, consulta, organização<br/>e importação de contatos"]
  csv[/"📄 Arquivo CSV<br/><i>Exportado de planilhas<br/>ou outros sistemas</i>"/]

  user -- "Usa via navegador (HTTPS)" --> sys
  user -- "Prepara e envia" --> csv
  csv -- "Importado por" --> sys

  classDef person fill:#1E3A8A,color:#fff,stroke:#1E3A8A
  classDef system fill:#3B5BDB,color:#fff,stroke:#1E3A8A
  class user person
  class sys system
```

Não há integrações com sistemas externos no escopo. O sistema é autocontido.

## 3.3 Nível 2 — Containers

```mermaid
flowchart TB
  user(["👤 Usuário"])

  subgraph sys["Gerenciador de Contatos"]
    spa["<b>SPA</b><br/>React 19 + Vite<br/><i>Interface, validação de formulário,<br/>cache de dados do servidor</i>"]
    api["<b>API</b><br/>Node.js + Fastify<br/><i>REST /api/v1, sessão, regras de<br/>negócio; serve o SPA em /</i>"]
    worker["<b>Worker</b><br/>Node.js + pg-boss<br/><i>Processa importações e<br/>rotinas agendadas</i>"]
    db[("<b>PostgreSQL</b><br/><i>Contatos, usuários, sessões,<br/>importações, fila pg-boss</i>")]
  end

  user -- "HTTPS" --> api
  api -- "Entrega HTML/JS/CSS" --> spa
  spa -- "JSON/HTTPS, cookie de sessão<br/>(mesma origem)" --> api
  api -- "SQL (Drizzle)<br/>+ enfileira job na mesma transação" --> db
  worker -- "Consome jobs (SKIP LOCKED)<br/>+ grava contatos/erros" --> db

  classDef c fill:#3B5BDB,color:#fff,stroke:#1E3A8A
  classDef d fill:#1E3A8A,color:#fff,stroke:#1E3A8A
  class spa,api,worker c
  class db d
```

| Container  | Tecnologia                                                | Responsabilidades                                                               | Escala                                  |
| ---------- | --------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------- |
| SPA        | React 19.3, Vite 8, TanStack Query/Router/Form, shadcn/ui | UI, navegação, validação de formulário, cache, acessibilidade                   | Estático, servido pela API              |
| API        | Node.js LTS, Fastify, Drizzle, Zod                        | Autenticação, autorização por dono, casos de uso, OpenAPI, headers de segurança | Horizontal (stateless; sessão no banco) |
| Worker     | Mesmo código da API, entrypoint `worker.ts`               | Importação de CSV, expurgo de dados, limpeza de sessões                         | Horizontal (`SKIP LOCKED`)              |
| PostgreSQL | PostgreSQL 16+ com `citext`, `pg_trgm`, `unaccent`        | Persistência, invariantes, fila                                                 | Vertical                                |

## 3.4 Nível 3 — Componentes da API

```mermaid
flowchart LR
  subgraph http["Borda HTTP (Fastify)"]
    plugins["Plugins globais<br/>helmet · rate-limit · cookie<br/>static (SPA) · swagger"]
    authHook["Hook de autenticação<br/>sessão → request.user"]
    csrf["Hook anti-CSRF<br/>X-Requested-With"]
    errH["Error handler<br/>→ Problem Details"]
  end

  subgraph auth["Módulo auth"]
    aR["routes"] --> aUC["use-cases<br/>register · login · logout"]
    aUC --> aRepo["repos<br/>users · sessions"]
    aUC --> aDom["domain<br/>política de senha"]
  end

  subgraph contacts["Módulo contacts"]
    cR["routes"] --> cUC["use-cases<br/>create · list · get · update<br/>deactivate · reactivate<br/>favorite · anonymize"]
    cUC --> cRepo["repository<br/>(Drizzle)"]
    cUC --> cDom["domain<br/>phone · contact rules<br/>status transitions"]
  end

  subgraph imports["Módulo imports"]
    iR["routes"] --> iUC["use-cases<br/>enqueue · get · list<br/>errors · delete"]
    iJob["jobs<br/>process-import · purge"] --> iDom["domain<br/>csv-sniffer · row-validator<br/>csv-escape"]
    iUC --> iRepo["repository"]
    iJob --> iRepo
    iUC --> q["JobQueue (porta)<br/>pg-boss (adaptador)"]
  end

  subgraph shared["shared"]
    db["db client<br/>+ transações"]
    cfg["config (env Zod)"]
    log["logger (pino + redact)"]
  end

  contracts[["packages/contracts<br/>schemas Zod · códigos de erro"]]

  plugins --> authHook --> csrf --> aR & cR & iR
  cR & iR & aR -.-> contracts
  iDom --> cDom
  cRepo & iRepo & aRepo --> db
  q --> db
```

**Regras de dependência**
- `routes` conhecem `use-cases` e `contracts`; nunca acessam repositórios diretamente.
- `use-cases` orquestram transações e chamam `domain` e repositórios.
- `domain` não importa nada de I/O (verificado por regra de lint `no-restricted-imports`).
- O módulo `imports` reutiliza o domínio de `contacts` (validação e normalização), nunca o repositório de `contacts` por fora de um caso de uso.

## 3.5 Modelo de dados

```mermaid
erDiagram
  users ||--o{ sessions : "possui"
  users ||--o{ contacts : "é dono de"
  users ||--o{ imports : "realiza"
  imports ||--o| import_files : "conteúdo (temporário)"
  imports ||--o{ import_errors : "registra"

  users {
    uuid id PK
    citext email UK
    text password_hash
    varchar name
    timestamptz created_at
  }
  sessions {
    bytea id_hash PK
    uuid user_id FK
    timestamptz created_at
    timestamptz last_seen_at
    timestamptz expires_at
    text user_agent
    inet ip
  }
  contacts {
    uuid id PK "uuidv7"
    uuid owner_id FK
    varchar name
    citext email "null só se anonimizado"
    varchar mobile_e164 "UK(owner_id, mobile_e164)"
    varchar phone_e164 "opcional"
    boolean is_favorite
    timestamptz deactivated_at "null = ativo"
    timestamptz anonymized_at "LGPD"
    int version "optimistic locking"
    timestamptz created_at
    timestamptz updated_at
  }
  imports {
    uuid id PK
    uuid owner_id FK
    varchar file_name
    char file_sha256 "idx(owner_id, file_sha256)"
    varchar status
    int total_rows
    int processed_rows
    int created_count
    int skipped_count
    int failed_count
    text failure_reason
    timestamptz created_at
    timestamptz started_at
    timestamptz finished_at
  }
  import_files {
    uuid import_id PK
    bytea content "≤ 5 MB; expurgado ao fim"
  }
  import_errors {
    bigint id PK
    uuid import_id FK
    int line_number
    jsonb raw "expurgado após 30 dias"
    jsonb errors "[{field, code, message}]"
  }
```

**Constraints e índices relevantes**

| Objeto                                         | Definição                                                                              | Finalidade                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `contacts_owner_mobile_uq`                     | `UNIQUE (owner_id, mobile_e164)`                                                       | RN03; `NULL`s distintos liberam o número após anonimização |
| `contacts_pii_chk`                             | `CHECK (anonymized_at IS NOT NULL OR (email IS NOT NULL AND mobile_e164 IS NOT NULL))` | RN01 + RN09                                                |
| `contacts_list_idx`                            | `(owner_id, deactivated_at, is_favorite, name, id)`                                    | Listagem paginada e filtros                                |
| `contacts_name_trgm`                           | `GIN (f_unaccent(lower(name)) gin_trgm_ops)`                                           | Busca por nome (ADR-005)                                   |
| `contacts_email_trgm` / `contacts_mobile_trgm` | GIN trigram                                                                            | Busca por e-mail/celular                                   |
| `imports_owner_hash_idx`                       | `(owner_id, file_sha256)`                                                              | Detecção de reenvio (RN13)                                 |
| `import_errors_import_line_idx`                | `(import_id, line_number)`                                                             | Paginação dos erros                                        |

## 3.6 Implantação

### Produção — Render (Blueprint `render.yaml`)

Variante free: sem Background Worker nem pre-deploy, a API consome as filas e aplica as migrations na inicialização com `pg_advisory_lock`. Limitações: hibernação após 15 min sem tráfego, expurgo diário só com o serviço acordado e expiração do Postgres em 30 dias, sem backup.

```mermaid
flowchart TB
  browser(["Navegador"])
  subgraph render["Render"]
    direction TB
    web["<b>Web Service</b> free (Docker)<br/>node dist/server.js<br/>API /api/v1 + SPA /<br/>worker embutido: WORKER_MODE=embedded<br/>migrations na inicialização<br/>health: /api/health/ready"]
    pg[("<b>Render Postgres</b> free<br/>citext · pg_trgm · unaccent")]
  end
  gh["GitHub<br/>main protegida"]

  browser -- "HTTPS (TLS da plataforma)" --> web
  web --> pg
  gh -- "deploy automático após CI verde" --> render
```

| Variante                   | Diferença                                                                                                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Render pago**            | Background Worker (`WORKER_MODE=standalone`) e migrations no `preDeployCommand` (`node dist/migrate.js`, `MIGRATE_ON_BOOT=false`), em planos pagos. Topologia de referência do ADR-010. |
| **Local (Docker Compose)** | Serviços `postgres`, `migrate` (one-off), `api`, `worker`. Em desenvolvimento, o Vite roda com _proxy_ de `/api` para a API, mantendo a mesma origem.                                   |

### Configuração (variáveis de ambiente)

| Variável                                    | Exemplo                    | Uso                                                 |
| ------------------------------------------- | -------------------------- | --------------------------------------------------- |
| `DATABASE_URL`                              | `postgres://…`             | Conexão                                             |
| `NODE_ENV`                                  | `production`               | Comportamento                                       |
| `WORKER_MODE`                               | `standalone` \| `embedded` | Consumo da fila                                     |
| `MIGRATE_ON_BOOT`                           | `true` \| `false`          | Migrations na inicialização (Render free)           |
| `SESSION_COOKIE_NAME`                       | `__Host-sid`               | `sid` em dev sem HTTPS                              |
| `SESSION_IDLE_MINUTES` / `SESSION_MAX_DAYS` | `120` / `7`                | Expiração                                           |
| `IMPORT_MAX_BYTES`                          | `5242880`                  | Limite de upload                                    |
| `IMPORT_ERRORS_RETENTION_DAYS`              | `30`                       | Retenção (RN15)                                     |
| `LOG_LEVEL`                                 | `info`                     | Logs                                                |
| `WEB_DIST_DIR` (opcional)                   | `/app/apps/web/dist`       | Build do SPA servido em `/`; padrão `apps/web/dist` |

## 3.7 Preocupações transversais

| Tema           | Abordagem                                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Erros          | Problem Details (RFC 9457) com `code` estável; violação `23505` → `409`; erros inesperados → `500` sem detalhes internos, com `requestId`  |
| Logs           | `pino` JSON com `requestId`, `userId` (UUID) e duração; `redact` para corpo, cookies, `authorization` e `q`                                |
| Segurança HTTP | `@fastify/helmet`: CSP estrita com Trusted Types, HSTS, `frame-ancestors 'none'`, `Referrer-Policy: same-origin`, `X-Content-Type-Options` |
| Limites        | Corpo JSON ≤ 100 KB; upload ≤ 5 MB; `pageSize` ≤ 100; rate limit por IP e por conta nas rotas de auth                                      |
| Saúde          | `/api/health/live` (processo) e `/api/health/ready` (consulta `SELECT 1`)                                                                  |
| Encerramento   | `SIGTERM` → fecha o servidor HTTP e chama `boss.stop({ graceful: true })`                                                                  |
