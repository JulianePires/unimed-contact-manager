# ADR-004 — Modelo de dados e contrato da API REST

- **Status:** Aceito
- **Data:** 2026-10-23
- **Relacionados:** ADR-001, ADR-002, ADR-005

## Contexto

É preciso definir o modelo relacional dos contatos e o contrato REST para cadastro, consulta paginada com busca e filtros, edição, inativação/reativação e favoritos, além da importação.

## Decisão

### Modelo

```
users     (id uuid PK, email citext UNIQUE, password_hash, name, created_at)

contacts  (id uuid PK,                 -- UUID v7
           owner_id uuid NOT NULL → users(id),
           name varchar(120) NOT NULL,
           email citext,                         -- obrigatório salvo anonimização (ADR-009)
           mobile_e164 varchar(16),              -- obrigatório salvo anonimização (ADR-009)
           phone_e164 varchar(16) NULL,
           is_favorite boolean NOT NULL DEFAULT false,
           deactivated_at timestamptz NULL,      -- NULL = ativo
           anonymized_at timestamptz NULL,       -- LGPD (ADR-009)
           version integer NOT NULL DEFAULT 1,
           created_at, updated_at,
           UNIQUE (owner_id, mobile_e164))
```

- **Obrigatórios:** nome, e-mail e celular. Telefone fixo é opcional e, quando informado, normalizado e validado.
- **UUID v7:** ordenável no tempo (boa localidade no B-tree) e não expõe volume do sistema. Gerado pela aplicação, o que independe da versão do PostgreSQL do provedor; com PostgreSQL ≥ 18, pode migrar para o `uuidv7()` nativo.
- **`deactivated_at` em vez de boolean:** representa o estado e o momento da mudança. A API expõe `status: "active" | "inactive"`.
- **Sem exclusão física:** inativar é o soft delete do domínio. A eliminação de dados pessoais exigida pela LGPD é tratada por anonimização (ver ADR-009).

### Contrato (`/api/v1`)

| Método       | Rota                                                   | Observação                                      |
| ------------ | ------------------------------------------------------ | ----------------------------------------------- |
| GET          | `/contacts?page&pageSize&q&favorite&status&sort`       | Paginação por offset                            |
| POST         | `/contacts`                                            | 201 / 409 (ADR-001)                             |
| GET          | `/contacts/:id`                                        | Retorna `ETag`                                  |
| PATCH        | `/contacts/:id`                                        | Apenas dados; exige `If-Match`                  |
| PUT / DELETE | `/contacts/:id/favorite`                               | Favorito como recurso; idempotente              |
| POST         | `/contacts/:id/deactivate`, `/contacts/:id/reactivate` | Ações de negócio; idempotentes                  |
| DELETE       | `/contacts/:id`                                        | Anonimização (LGPD), só para inativos (ADR-009) |
| POST         | `/imports`                                             | multipart; 202 Accepted                         |
| GET          | `/imports`, `/imports/:id`                             | Status e contadores                             |
| GET          | `/imports/:id/errors?page`, `/imports/:id/errors.csv`  | Linhas com erro                                 |
| GET          | `/imports/template.csv`                                | Modelo de arquivo                               |

### Paginação

Offset (`page`, `pageSize` ≤ 100) com **ordenação determinística** (`<campo>, id`). Resposta: `{ data, meta: { page, pageSize, total, totalPages } }`.

### Concorrência de edição (optimistic locking)

`GET` devolve `ETag` derivado de `version`. `PATCH` exige `If-Match`; o `UPDATE ... WHERE id = $1 AND version = $2` incrementa a versão. Zero linhas afetadas → `412 Precondition Failed`, e o front informa que o contato foi alterado em outra sessão. Ausência de `If-Match` → `428 Precondition Required`.

### Erros

RFC 9457 (Problem Details, `application/problem+json`) com `code` estável (`MOBILE_ALREADY_EXISTS`, `MOBILE_BELONGS_TO_INACTIVE_CONTACT`, `VALIDATION_ERROR`, `CONTACT_MODIFIED`…) e `errors[]` por campo. O front traduz pelo `code`.

### Isolamento

Toda consulta filtra por `owner_id` do usuário autenticado; recurso de outro usuário responde `404` (não `403`), para não revelar existência.

## Alternativas consideradas

- **Paginação por cursor:** consistente sob escrita e eficiente em volumes grandes, mas sem total nem salto de página. Desnecessária para o volume de uma agenda por usuário; fica registrada como evolução.
- **Favorito e status via PATCH genérico:** menos rotas, porém mistura edição de dados com transições de estado e permite mudanças acidentais.
- **Última escrita vence:** mais simples, mas perde edições silenciosamente.

## Consequências

- (+) Contrato explícito, idempotente onde importa e fácil de documentar em OpenAPI.
- (+) Edições concorrentes detectadas, nunca perdidas.
- (−) Front precisa guardar e enviar o `ETag` nas edições.
- (−) E-mail obrigatório aumenta a taxa de linhas rejeitadas na importação de bases incompletas.
