# 8. Análise de qualidade de software

A análise usa o modelo de qualidade de produto da **ISO/IEC 25010:2023**, com nove características. Para cada uma: o que significa neste sistema, como as decisões a atendem, como é verificada e quais riscos permanecem.

> Escala de prioridade para este produto: **Alta** = falha compromete o propósito do desafio · **Média** = degrada a experiência ou a operação · **Baixa** = pouco relevante no escopo.

## 8.1 Visão geral

| Característica           | Prioridade | Decisões-chave         | Verificação principal                  |
| ------------------------ | ---------- | ---------------------- | -------------------------------------- |
| Adequação funcional      | Alta       | ADR-001, 002, 004      | Casos de uso, T-INT01–15, e2e          |
| Eficiência de desempenho | Média      | ADR-003, 005           | T-NF01–02, `EXPLAIN` em T-INT07        |
| Compatibilidade          | Baixa      | ADR-004, 008           | OpenAPI, Playwright multi-browser      |
| Capacidade de interação  | Alta       | ADR-008                | axe, Lighthouse, teste por teclado     |
| Confiabilidade           | Alta       | ADR-001, 002, 003, 010 | T-INT04, T-INT12, T-INT13              |
| Segurança                | Alta       | ADR-006, 008, 009      | T-INT05, T-INT16, T-INT17, T-NF04      |
| Manutenibilidade         | Alta       | ADR-007, 010           | Lint de dependências, cobertura, tipos |
| Flexibilidade            | Média      | ADR-003, 007, 010      | Compose, Blueprint, `WORKER_MODE`      |
| Proteção (_safety_)      | Baixa      | ADR-009                | Confirmações de ações irreversíveis    |

## 8.2 Análise por característica

### Adequação funcional (_completude, correção, adequação_)

- **Completude:** todos os requisitos do enunciado estão mapeados em RF/RN (`01`) e em casos de uso (`02`). Os itens adicionais (anonimização, CSV de erros, modelo) decorrem de decisões registradas e não ampliam o escopo sem justificativa.
- **Correção:** as regras mais propensas a erro foram desenhadas para serem corretas por construção: unicidade e idempotência no banco, normalização antes de persistir, concorrência otimista na edição.
- **Adequação:** a busca única com detecção de intenção e a sugestão de reativar reduzem passos para as tarefas mais frequentes.
- **Risco residual:** a classificação de celular depende dos metadados da `libphonenumber-js`; números de faixas novas podem ser rejeitados até atualização da biblioteca.

### Eficiência de desempenho (_tempo, recursos, capacidade_)

- Listagem com índice composto e paginação por offset, adequada ao volume esperado por usuário.
- Busca com índices GIN trigram sobre `f_unaccent(lower(...))`.
- Importação em stream e lotes de 500 com inserção em massa; worker isolado da API (modo `standalone`).
- **Riscos:** offset degrada em páginas profundas (mitigação documentada: cursor); arquivo em `bytea` limita o tamanho de upload a 5 MB e ocupa o banco durante o processamento (expurgo ao término); `ILIKE '%…%'` com termos de 1–2 caracteres não aproveita trigramas (mínimo de 2 caracteres e debounce).

### Compatibilidade (_coexistência, interoperabilidade_)

- API REST versionada (`/api/v1`) com OpenAPI 3.1 e erros padronizados (RFC 9457), consumível por outros clientes.
- CSV tolerante às variações reais (Excel pt-BR: `;` e Windows-1252).
- Navegadores evergreen testados com Chromium, Firefox e WebKit.

### Capacidade de interação (_operabilidade, proteção contra erros, inclusividade, autodescrição_)

- **Inclusividade:** meta WCAG 2.2 AA, com componentes Radix e verificação automática: axe em testes de componente e em cada tela dos e2e, Lighthouse CI e um cenário e2e executado só com teclado (T-E2E04). Não há registro de verificação com leitor de tela.
- **Proteção contra erros do usuário:** validação imediata com o mesmo schema da API; confirmação em inativar e eliminar; "Desfazer" após inativar; aviso antes de reimportar um arquivo; `412` impede sobrescrever o trabalho de outra sessão.
- **Autodescrição e assistência:** mensagens orientadas à ação ("Este celular pertence a um contato inativo. Reativar?"), CSV modelo, relatório de erros por linha e campo.
- **Engajamento:** atualização otimista e transições respeitando `prefers-reduced-motion`.
- **Risco:** o ecossistema TanStack exige disciplina para manter os anúncios `aria-live` concisos.

### Confiabilidade (_ausência de falhas, tolerância a falhas, disponibilidade, recuperabilidade_)

- **Tolerância a falhas:** retentativas com backoff no pg-boss; inserção idempotente; checkpoint por lote na mesma transação dos contadores.
- **Integridade sob concorrência:** constraint única como fonte da verdade, provada por T-INT04 e T-INT19.
- **Atomicidade:** importação, arquivo e job na mesma transação (sem _dual write_), provada por T-INT13.
- **Disponibilidade:** deploy sem downtime com health checks; _graceful shutdown_.
- **Riscos:** a publicação usa o plano free do Render (`render.yaml`): o serviço hiberna, o banco expira em 30 dias e não há backup.

### Segurança (_confidencialidade, integridade, autenticidade, responsabilização, resistência_)

| Ameaça (STRIDE)                                          | Mitigação                                                                     | Teste            |
| -------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------- |
| _Spoofing_: roubo de sessão por XSS                      | Cookie `HttpOnly`, CSP estrita + Trusted Types, sem `dangerouslySetInnerHTML` | T-NF04, T-UF09   |
| _Spoofing_: força bruta                                  | argon2id + rate limit + mensagens genéricas                                   | T-INT16          |
| _Spoofing_: session fixation                             | Novo ID a cada login                                                          | T-INT16          |
| _Tampering_: CSRF                                        | `SameSite=Lax` + header obrigatório em mutações                               | T-INT16          |
| _Tampering_: CSV injection                               | Neutralização de fórmulas no export                                           | T-INT17          |
| _Repudiation_                                            | Logs estruturados com `requestId` e `userId` (sem PII de contatos)            | Revisão          |
| _Information disclosure_: IDOR                           | Filtro por `owner_id` em toda consulta; `404` para recursos alheios; UUIDs    | T-INT05, T-E2E05 |
| _Information disclosure_: vazamento da tabela de sessões | Apenas hash do ID armazenado                                                  | T-INT16          |
| _Denial of service_                                      | Limites de corpo/upload, `pageSize` máximo, rate limit, worker separado       | T-NF02           |
| _Elevation of privilege_                                 | Não há papéis; toda rota exige sessão, exceto auth/health                     | T-INT16          |
- **Cadeia de suprimentos:** lockfile, `pnpm audit`, atualização automatizada, versões fixadas.
- **Risco residual:** logs de requisição da plataforma podem registrar a query string com `q` (avaliado no ADR-009).

### Manutenibilidade (_modularidade, reusabilidade, analisabilidade, modificabilidade, testabilidade_)

- **Modularidade:** monolito modular por feature com regras de dependência verificadas por lint.
- **Reusabilidade:** `packages/contracts` compartilha schemas, tipos e normalização entre front e back; o domínio de contatos é reutilizado pela importação.
- **Analisabilidade:** TypeScript strict, Problem Details com `code`, logs com `requestId`, ADRs para cada decisão relevante.
- **Modificabilidade:** fila atrás de uma porta (`JobQueue`); evoluções documentadas (cursor, object storage, cache de sessão) sem reescrita.
- **Testabilidade:** domínio sem I/O; `buildApp()` testável via `inject`; relógio injetável; MSW tipado.

### Flexibilidade (_adaptabilidade, escalabilidade, instalabilidade, substituibilidade_)

- **Instalabilidade:** `docker compose up` local; `render.yaml` declarativo.
- **Adaptabilidade:** `WORKER_MODE` permite operar com ou sem serviço de worker.
- **Escalabilidade:** API stateless (sessão no banco) e workers concorrentes via `SKIP LOCKED`; o banco é o limite vertical.
- **Substituibilidade:** PostgreSQL padrão com extensões comuns; adaptador de fila substituível.

### Proteção (_safety_)

Não há risco físico ou à vida envolvido. O aspecto aplicável é evitar dano irreversível a dados: eliminação só de contatos inativos, com confirmação explícita, e importação que nunca sobrescreve nem reativa contatos.

## 8.3 Rastreabilidade e status

Status verificado no código e nos testes em 27/10/2026: ✅ atendido · ⚠️ parcial · ❌ não atendido. Os números das medições estão em [09 §9.8](09-estrategia-de-testes.md#98-resultados-medidos).

### Requisitos funcionais

| Requisito | UC   | Endpoint(s)                         | ADR      | Testes                                       | Status |
| --------- | ---- | ----------------------------------- | -------- | -------------------------------------------- | ------ |
| RF01      | UC01 | `POST /auth/register`               | 006      | T-INT16, T-E2E01                             | ✅     |
| RF02      | UC02 | `POST /auth/login`                  | 006      | T-INT16, T-E2E01                             | ✅     |
| RF03      | UC03 | `POST /auth/logout[-all]`           | 006      | T-INT16, T-UF10                              | ✅     |
| RF04      | —    | hook de autenticação                | 006      | T-INT16, T-UF09, T-E2E01                     | ✅     |
| RF05      | UC04 | `POST /contacts`                    | 001, 004 | T-INT01–04, T-UF01–02, T-E2E02               | ✅     |
| RF06      | UC05 | `GET /contacts`                     | 004      | T-INT06, T-UF06, T-NF01                      | ✅     |
| RF07      | UC05 | `GET /contacts?q`                   | 005, 009 | T-UB08, T-INT07, T-UF05, T-NF01              | ✅     |
| RF08      | UC05 | `GET /contacts?status&favorite`     | 004      | T-INT08, T-UF06                              | ✅     |
| RF09      | UC06 | `GET /contacts/:id`                 | 004      | T-INT05, T-E2E05                             | ✅     |
| RF10      | UC07 | `PATCH /contacts/:id`               | 004      | T-INT09, T-UF03                              | ✅     |
| RF11      | UC08 | `POST /contacts/:id/deactivate`     | 004      | T-INT10, T-E2E02, T-E2E04                    | ✅     |
| RF12      | UC09 | `POST /contacts/:id/reactivate`     | 001, 004 | T-INT10, T-UF02, T-E2E02, T-E2E04            | ✅     |
| RF13      | UC10 | `PUT/DELETE /contacts/:id/favorite` | 004      | T-INT10, T-UF04                              | ✅     |
| RF14      | UC11 | `DELETE /contacts/:id`              | 009      | T-INT15, teste de componente do detalhe      | ✅     |
| RF15      | UC12 | `POST /imports`                     | 002, 003 | T-INT13, T-UF08, T-E2E03                     | ✅     |
| RF16      | UC15 | job `process-import`                | 002, 003 | T-INT11, T-INT12, T-NF02                     | ✅     |
| RF17      | UC13 | `GET /imports/:id`                  | 002      | T-UF07, T-E2E03                              | ✅     |
| RF18      | UC14 | `GET /imports/:id/errors`           | 002      | T-INT11, T-E2E03                             | ✅     |
| RF19      | UC14 | `GET /imports/:id/errors.csv`       | 002, 009 | T-INT17, T-E2E03                             | ✅     |
| RF20      | UC12 | `GET /imports/template.csv`         | 002      | teste de componente da página de importações | ✅     |
| RF21      | UC13 | `GET /imports`                      | 004      | teste de componente do histórico             | ✅     |
| RF22      | UC12 | `POST /imports?force=true`          | 002      | T-INT12, T-INT14, T-UF08, T-E2E03            | ✅     |
| RF23      | UC13 | `DELETE /imports/:id`               | 009      | T-INT05, teste de componente da exclusão     | ✅     |

### Regras de negócio

| Regra | Onde é garantida                                                                   | Testes                   | Status |
| ----- | ---------------------------------------------------------------------------------- | ------------------------ | ------ |
| RN01  | Schemas de `contracts` (API e formulários)                                         | T-UB03, T-UF01           | ✅     |
| RN02  | `normalizeMobile`/`normalizePhone` (`libphonenumber-js`)                           | T-UB01–02, T-INT01       | ✅     |
| RN03  | `UNIQUE (owner_id, mobile_e164)`                                                   | **T-INT04**, T-INT02     | ✅     |
| RN04  | `409 MOBILE_BELONGS_TO_INACTIVE_CONTACT` + `InactiveConflictAlert`                 | T-INT03, T-UF02, T-E2E02 | ✅     |
| RN05  | Sem unicidade de e-mail                                                            | T-INT01                  | ✅     |
| RN06  | Filtro por `owner_id`; `404` para recurso alheio                                   | T-INT05, T-E2E05         | ✅     |
| RN07  | `If-Match`/`ETag` com `version`                                                    | T-INT09, T-UF03          | ✅     |
| RN08  | Rotas idempotentes                                                                 | T-UB06, T-INT10          | ✅     |
| RN09  | Anonimização só de inativos                                                        | T-UB06, T-INT15          | ✅     |
| RN10  | Detecção de BOM, delimitador e encoding; limite de 5 MB                            | T-UB04, T-UF08, T-E2E03  | ✅     |
| RN11  | `ON CONFLICT DO NOTHING` → `skipped`                                               | T-INT11                  | ✅     |
| RN12  | `DUPLICATE_IN_FILE` com `firstLine`                                                | T-INT11                  | ✅     |
| RN13  | Hash do arquivo + `force=true`                                                     | **T-INT12**, T-INT14     | ✅     |
| RN14  | Status final calculado no domínio                                                  | T-UB09                   | ✅     |
| RN15  | Arquivo apagado ao fim do processamento; `raw` expurgado após 30 dias (job diário) | T-INT18                  | ✅     |
| RN16  | `q` fora dos search params do router                                               | T-UF05                   | ✅     |

### Requisitos não funcionais

| RNF   | Evidência                                                                                                                                                  | Status |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| RNF01 | Cookie `HttpOnly; SameSite=Lax`, `Secure` sob HTTPS (`SECURE_TRANSPORT`); nenhum token no JavaScript (T-INT16, T-UF09)                                     | ✅     |
| RNF02 | argon2id; só o SHA-256 do ID de sessão é gravado (T-INT16)                                                                                                 | ✅     |
| RNF03 | CSRF por header (T-INT16); CSP estrita + Trusted Types (teste de headers, T-E2E01); CSV injection (T-UB05, T-INT17)                                        | ✅     |
| RNF04 | `404` para recurso alheio (T-INT05, T-E2E05)                                                                                                               | ✅     |
| RNF05 | Rate limit por IP e por conta, `429` com `Retry-After` (T-INT16)                                                                                           | ✅     |
| RNF06 | 20 `POST` simultâneos → 1 × `201`, 19 × `409` (**T-INT04**). A disputa API × worker (T-INT19) não tem teste próprio; a garantia é a mesma constraint       | ✅     |
| RNF07 | Reprocessamento com `created = 0`; retentativa após falha no 2º lote sem duplicar (**T-INT12**); rollback do enfileiramento (T-INT13)                      | ✅     |
| RNF08 | `healthCheckPath: /api/health/ready`; `SIGTERM` encerra API e worker de forma graciosa                                                                     | ✅     |
| RNF09 | k6, 20 VUs, 10 mil contatos: p95 de 220 ms (listagem) e 167 ms (busca), medido localmente (T-NF01)                                                         | ✅     |
| RNF10 | 10 mil linhas em 7,4 s; p95 durante a importação de 258 ms (listagem) e 238 ms (busca), medido localmente (T-NF02)                                         | ✅     |
| RNF11 | axe sem violações _serious/critical_ em todas as telas dos e2e; Lighthouse Acessibilidade 100; fluxo só com teclado (T-E2E04) em Chromium, Firefox e móvel | ✅     |
| RNF12 | Validação ao sair do campo, `ErrorSummary` com foco, mensagens em português, "Reativar" e "Desfazer" (T-UF01–03)                                           | ✅     |
| RNF13 | E2e em viewport móvel de **390 px**; 320 px não é testado                                                                                                  | ⚠️     |
| RNF14 | Anonimização, retenção da importação e redação de `q`, cookies e corpo nos logs; **sessões expiradas não são expurgadas** (8.4)                            | ⚠️     |
| RNF15 | `no-restricted-imports` impede importar repositórios de outro módulo                                                                                       | ✅     |
| RNF16 | Cobertura de linhas: 100% no backend (unitários + integração), 100% em `contracts`, 98,9% no front                                                         | ✅     |
| RNF17 | TypeScript strict, ESLint e Biome no CI; logs `pino` com `reqId`                                                                                           | ✅     |
| RNF18 | `docker compose up` sobe a stack; `render.yaml` versionado                                                                                                 | ✅     |
| RNF19 | Playwright em Chromium, Firefox, WebKit e móvel; T-E2E04 não roda no WebKit (Tab não foca links, como no Safari padrão)                                    | ✅     |
| RNF20 | `/api/docs` fora de produção; `docs/openapi.json` versionado e conferido no CI (`openapi:check`)                                                           | ✅     |

## 8.4 Limitações conhecidas e evolução

| Limitação                                        | Impacto                                                                     | Evolução proposta                                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Sessões expiradas não são removidas do banco     | A tabela cresce; IP e user agent ficam guardados além do necessário (RNF14) | Incluir a remoção de sessões expiradas no job diário `purge-retention`                                                                 |
| Lighthouse: Performance 71–81 e Boas práticas 93 | Abaixo das metas do T-NF03 (≥ 90 e ≥ 95); no CI, só Acessibilidade bloqueia | Reduzir o JavaScript da carga inicial; resolver os avisos de CSP do sonner, o `favicon.ico` ausente e o `401` de `/auth/me` no console |
| Viewport de 320 px sem teste automatizado        | Regressões de layout nessa largura passam despercebidas (RNF13)             | Projeto Playwright em 320 px                                                                                                           |
| Sem verificação registrada com leitor de tela    | Problemas que o axe não detecta podem passar                                | Roteiro manual com NVDA e VoiceOver nos fluxos críticos                                                                                |
| T-E2E04 (só teclado) não roda no WebKit          | Navegação por teclado no Safari sem cobertura automática                    | Testar com a preferência "Pressionar Tab para destacar cada item" ligada                                                               |
| Medições de desempenho só locais                 | p95 e tempo de importação em produção não foram medidos                     | k6 contra um ambiente de homologação antes de releases                                                                                 |
| Paginação por offset                             | Lenta em páginas muito profundas                                            | Cursor (keyset) se o volume por usuário crescer em ordens de grandeza                                                                  |
| Arquivo em `bytea` (≤ 5 MB)                      | Limita o tamanho dos uploads                                                | Object storage (S3/R2) mantendo pg-boss e a transação para o registro                                                                  |
| Uma consulta de sessão por requisição            | Carga extra no banco                                                        | Cache em memória com TTL curto                                                                                                         |
| Sem recuperação de senha                         | Usuário depende de suporte                                                  | Fluxo por e-mail com token de uso único                                                                                                |
| Sem exportação da agenda                         | Portabilidade (LGPD) parcial                                                | `GET /contacts/export.csv`, com toda célula neutralizada contra fórmulas pelo `escapeCsvCell` (ADR-009 §6)                             |
| Logs da plataforma podem conter `q`              | Exposição residual de PII                                                   | Busca via `POST /contacts/search` ou configuração de logs do provedor                                                                  |
| Produção no plano free do Render                 | Hibernação; banco expira em 30 dias, sem backup; sem conta demo             | Planos pagos (ADR-010, README › Deploy); até lá, `pg_dump` antes do prazo                                                              |
