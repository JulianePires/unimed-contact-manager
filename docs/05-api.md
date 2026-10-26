# 5. API REST

- **Base:** `/api/v1` (mesma origem do SPA)
- **Formato:** JSON (`application/json`); erros em `application/problem+json` (RFC 9457)
- **Autenticação:** cookie de sessão `HttpOnly` (ADR-006). Exceto `register`, `login` e `health`, toda rota exige sessão → `401` se ausente ou expirada.
- **CSRF:** `POST`, `PUT`, `PATCH` e `DELETE` exigem o header `X-Requested-With: fetch` → `403 CSRF_HEADER_MISSING` se ausente.
- **Isolamento:** recursos de outro usuário respondem `404`.
- **Documentação viva:** OpenAPI 3.1 gerado dos schemas Zod das rotas, servido em `/api/docs` (fora de produção) e exportado para [`docs/openapi.json`](openapi.json) por `pnpm openapi:export`. O CI roda `pnpm openapi:check` e falha se o arquivo versionado não corresponder às rotas.

## 5.1 Convenções

| Tema              | Convenção                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| IDs               | UUID v7 (string)                                                                                                        |
| Datas             | ISO 8601 em UTC (`2026-10-24T14:03:00.000Z`)                                                                            |
| Campos            | `camelCase`                                                                                                             |
| Telefones         | Entrada livre (`(81) 99999-0000`, `+55 81 99999-0000`…); saída em E.164 (`+5581999990000`) e `…Formatted` para exibição |
| Paginação         | `page` (≥ 1, padrão 1) e `pageSize` (1–100, padrão 20)                                                                  |
| Envelope de lista | `{ "data": [...], "meta": { "page", "pageSize", "total", "totalPages" } }`                                              |
| Concorrência      | `ETag: "v<version>"` em `GET /contacts/:id`; `If-Match` obrigatório em `PATCH`                                          |
| Idempotência      | `PUT`/`DELETE` de favorito e `deactivate`/`reactivate` são idempotentes                                                 |

## 5.2 Erros

```json
{
  "type": "https://contatos.app/problems/mobile-already-exists",
  "title": "Celular já cadastrado",
  "status": 409,
  "code": "MOBILE_ALREADY_EXISTS",
  "detail": "Já existe um contato com este celular.",
  "instance": "/api/v1/contacts",
  "requestId": "01JB…",
  "contactId": "0192f…"
}
```

| HTTP | `code`                               | Quando                                                                |
| ---- | ------------------------------------ | --------------------------------------------------------------------- |
| 400  | `BAD_REQUEST`                        | JSON malformado, parâmetro de query inválido                          |
| 401  | `UNAUTHENTICATED`                    | Sem sessão válida                                                     |
| 401  | `INVALID_CREDENTIALS`                | Login falhou (mensagem genérica)                                      |
| 403  | `CSRF_HEADER_MISSING`                | Mutação sem `X-Requested-With`                                        |
| 404  | `NOT_FOUND`                          | Inexistente, de outro usuário ou eliminado                            |
| 409  | `MOBILE_ALREADY_EXISTS`              | Celular de contato ativo (inclui `contactId`)                         |
| 409  | `MOBILE_BELONGS_TO_INACTIVE_CONTACT` | Celular de contato inativo (inclui `contactId`)                       |
| 409  | `CONTACT_MUST_BE_INACTIVE`           | Eliminação de contato ativo                                           |
| 409  | `CONTACT_ANONYMIZED`                 | Ação sobre contato eliminado (quando identificável)                   |
| 409  | `IMPORT_ALREADY_EXISTS`              | Arquivo com mesmo hash já importado (inclui `importId`, `importedAt`) |
| 409  | `REGISTRATION_FAILED`                | Cadastro não concluído (e-mail em uso, sem revelar)                   |
| 412  | `CONTACT_MODIFIED`                   | `If-Match` desatualizado                                              |
| 413  | `FILE_TOO_LARGE`                     | Upload > 5 MB                                                         |
| 415  | `UNSUPPORTED_FILE_TYPE`              | Arquivo não CSV                                                       |
| 422  | `VALIDATION_ERROR`                   | Dados inválidos; inclui `errors[]`                                    |
| 428  | `PRECONDITION_REQUIRED`              | `PATCH` sem `If-Match`                                                |
| 429  | `RATE_LIMITED`                       | Limite excedido (com `Retry-After`)                                   |
| 500  | `INTERNAL_ERROR`                     | Erro inesperado (sem detalhes internos)                               |
| 503  | `SERVICE_UNAVAILABLE`                | Dependência indisponível (ex.: `/health/ready` sem banco)             |

Formato de `errors[]` em `422`:
```json
"errors": [
  { "field": "mobile", "code": "NOT_A_MOBILE_NUMBER", "message": "Informe um número de celular válido." },
  { "field": "email",  "code": "INVALID_EMAIL",       "message": "Informe um e-mail válido." }
]
```

## 5.3 Autenticação

| Método | Rota               | Corpo                       | Sucesso                 | Erros         |
| ------ | ------------------ | --------------------------- | ----------------------- | ------------- |
| POST   | `/auth/register`   | `{ name, email, password }` | `201` + cookie + `User` | 409, 422, 429 |
| POST   | `/auth/login`      | `{ email, password }`       | `200` + cookie + `User` | 401, 422, 429 |
| POST   | `/auth/logout`     | —                           | `204` + cookie expirado | 401           |
| POST   | `/auth/logout-all` | —                           | `204`                   | 401           |
| GET    | `/auth/me`         | —                           | `200 User`              | 401           |

`User`: `{ "id", "name", "email" }` · Senha: 12–128 caracteres.

## 5.4 Contatos

### Recurso `Contact`

```json
{
  "id": "0192f3a1-7c2e-7b10-9d4e-3f5a6b7c8d9e",
  "name": "Maria Silva",
  "email": "maria@empresa.com",
  "mobile": "+5581999990000",
  "mobileFormatted": "(81) 99999-0000",
  "phone": "+558133330000",
  "phoneFormatted": "(81) 3333-0000",
  "isFavorite": true,
  "status": "active",
  "deactivatedAt": null,
  "version": 3,
  "createdAt": "2026-10-20T12:00:00.000Z",
  "updatedAt": "2026-10-24T09:30:00.000Z"
}
```

### `GET /contacts`

| Parâmetro          | Tipo                                             | Padrão   | Descrição                                                                           |
| ------------------ | ------------------------------------------------ | -------- | ----------------------------------------------------------------------------------- |
| `page`, `pageSize` | int                                              | 1, 20    | Paginação                                                                           |
| `q`                | string (2–100)                                   | —        | Só dígitos → celular; com `@` → e-mail; demais → nome ou e-mail. Sem acentos/caixa. |
| `status`           | `active` \| `inactive` \| `all`                  | `active` | Filtro de status                                                                    |
| `favorite`         | `true` \| `false`                                | —        | Filtro de favoritos                                                                 |
| `sort`             | `name` \| `-name` \| `createdAt` \| `-createdAt` | `name`   | Ordenação (desempate por `id`)                                                      |

`200` → envelope de lista de `Contact`. Contatos eliminados nunca aparecem.

### `POST /contacts`

```json
{
  "name": "Maria Silva",
  "email": "maria@empresa.com",
  "mobile": "(81) 99999-0000",
  "phone": "81 3333-0000"
}
```
`201` + `Location` + `ETag` + `Contact` · Erros: `409 MOBILE_*`, `422`.

### `GET /contacts/:id`

`200` + `ETag: "v3"` + `Contact` · `404`.

### `PATCH /contacts/:id`

Header `If-Match: "v3"`. Corpo parcial com `name`, `email`, `mobile` e/ou `phone` (`phone: null` remove). Status e favorito **não** são aceitos aqui (→ `422`).
`200` + novo `ETag` · Erros: `404`, `409 MOBILE_*`, `412`, `422`, `428`.

### Favorito e status

| Método | Rota                       | Sucesso       | Observação  |
| ------ | -------------------------- | ------------- | ----------- |
| PUT    | `/contacts/:id/favorite`   | `204`         | Idempotente |
| DELETE | `/contacts/:id/favorite`   | `204`         | Idempotente |
| POST   | `/contacts/:id/deactivate` | `200 Contact` | Idempotente |
| POST   | `/contacts/:id/reactivate` | `200 Contact` | Idempotente |

### `DELETE /contacts/:id` — eliminação (LGPD)

`204` · `409 CONTACT_MUST_BE_INACTIVE` · `404`.

## 5.5 Importações

### Recurso `Import`

```json
{
  "id": "0192f…",
  "fileName": "clientes-outubro.csv",
  "status": "COMPLETED_WITH_ERRORS",
  "totalRows": 1200,
  "processedRows": 1200,
  "createdCount": 1150,
  "skippedCount": 38,
  "failedCount": 12,
  "failureReason": null,
  "createdAt": "…",
  "startedAt": "…",
  "finishedAt": "…"
}
```

| Método | Rota                      | Sucesso                       | Observação                                                                                       |
| ------ | ------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| POST   | `/imports[?force=true]`   | `202` + `Location` + `Import` | `multipart/form-data`, campo `file`. Sem `force`, um hash repetido → `409 IMPORT_ALREADY_EXISTS` |
| GET    | `/imports`                | `200` lista paginada          | Mais recentes primeiro                                                                           |
| GET    | `/imports/:id`            | `200 Import`                  | Usado no polling                                                                                 |
| DELETE | `/imports/:id`            | `204`                         | Remove importação e erros (contatos criados permanecem)                                          |
| GET    | `/imports/:id/errors`     | `200` lista paginada          | Ver abaixo                                                                                       |
| GET    | `/imports/:id/errors.csv` | `200 text/csv`                | `Content-Disposition: attachment`; células neutralizadas contra fórmulas                         |
| GET    | `/imports/template.csv`   | `200 text/csv`                | Cabeçalho + 2 linhas de exemplo                                                                  |

Item de `/imports/:id/errors`:
```json
{
  "lineNumber": 17,
  "raw": { "nome": "João", "email": "joao@", "celular": "8133330000", "telefone": "" },
  "errors": [
    { "field": "email", "code": "INVALID_EMAIL", "message": "E-mail inválido." },
    {
      "field": "celular",
      "code": "NOT_A_MOBILE_NUMBER",
      "message": "O número informado não é celular."
    }
  ]
}
```
Após o expurgo (RN15), `raw` é `null` e a resposta inclui `"rawPurged": true`.

### Formato do CSV

```csv
nome;email;celular;telefone
Maria Silva;maria@empresa.com;(81) 99999-0000;(81) 3333-0000
João Souza;joao@empresa.com;+55 81 98888-1111;
```

- Cabeçalho obrigatório, sem diferenciar maiúsculas e acentos (`nome`, `email`/`e-mail`, `celular`, `telefone` opcional).
- Delimitador `,` ou `;` (detectado); UTF-8 com ou sem BOM, ou Windows-1252.
- Linhas em branco são ignoradas; `lineNumber` considera o cabeçalho como linha 1.

Códigos de erro por linha: `REQUIRED`, `INVALID_EMAIL`, `INVALID_PHONE`, `NOT_A_MOBILE_NUMBER`, `NAME_TOO_SHORT`, `NAME_TOO_LONG`, `DUPLICATE_IN_FILE` (com `firstLine`), `COLUMN_COUNT_MISMATCH`.

## 5.6 Saúde

| Rota                | Sucesso                 | Falha |
| ------------------- | ----------------------- | ----- |
| `GET /health/live`  | `200 {status:"ok"}`     | —     |
| `GET /health/ready` | `200` (banco acessível) | `503` |
