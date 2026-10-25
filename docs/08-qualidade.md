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

- **Inclusividade:** meta WCAG 2.2 AA, com componentes Radix, verificação automática (axe) e manual (teclado e leitor de tela).
- **Proteção contra erros do usuário:** validação imediata com o mesmo schema da API; confirmação em inativar e eliminar; "Desfazer" após inativar; aviso antes de reimportar um arquivo; `412` impede sobrescrever o trabalho de outra sessão.
- **Autodescrição e assistência:** mensagens orientadas à ação ("Este celular pertence a um contato inativo. Reativar?"), CSV modelo, relatório de erros por linha e campo.
- **Engajamento:** atualização otimista e transições respeitando `prefers-reduced-motion`.
- **Risco:** o ecossistema TanStack exige disciplina para manter os anúncios `aria-live` concisos.

### Confiabilidade (_ausência de falhas, tolerância a falhas, disponibilidade, recuperabilidade_)

- **Tolerância a falhas:** retentativas com backoff no pg-boss; inserção idempotente; checkpoint por lote na mesma transação dos contadores.
- **Integridade sob concorrência:** constraint única como fonte da verdade, provada por T-INT04 e T-INT19.
- **Atomicidade:** importação, arquivo e job na mesma transação (sem _dual write_), provada por T-INT13.
- **Disponibilidade:** deploy sem downtime com health checks; _graceful shutdown_.
- **Riscos:** o plano free do Render hiberna e expira o banco (documentado; a avaliação usa plano pago); não há backup no free.

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

## 8.3 Rastreabilidade

| Requisito | UC   | Endpoint(s)                         | ADR      | Testes                   |
| --------- | ---- | ----------------------------------- | -------- | ------------------------ |
| RF01      | UC01 | `POST /auth/register`               | 006      | T-INT16, T-E2E01         |
| RF02      | UC02 | `POST /auth/login`                  | 006      | T-INT16, T-E2E01         |
| RF03      | UC03 | `POST /auth/logout[-all]`           | 006      | T-INT16, T-UF10          |
| RF04      | —    | hook de autenticação                | 006      | T-INT16, T-E2E01         |
| RF05      | UC04 | `POST /contacts`                    | 001, 004 | T-INT01–04, T-UF01–02    |
| RF06      | UC05 | `GET /contacts`                     | 004      | T-INT06, T-UF06          |
| RF07      | UC05 | `GET /contacts?q`                   | 005, 009 | T-UB08, T-INT07, T-UF05  |
| RF08      | UC05 | `GET /contacts?status&favorite`     | 004      | T-INT08, T-UF06          |
| RF09      | UC06 | `GET /contacts/:id`                 | 004      | T-INT05                  |
| RF10      | UC07 | `PATCH /contacts/:id`               | 004      | T-INT09, T-UF03          |
| RF11      | UC08 | `POST /contacts/:id/deactivate`     | 004      | T-INT10                  |
| RF12      | UC09 | `POST /contacts/:id/reactivate`     | 001, 004 | T-INT10, T-UF02, T-E2E02 |
| RF13      | UC10 | `PUT/DELETE /contacts/:id/favorite` | 004      | T-INT10, T-UF04          |
| RF14      | UC11 | `DELETE /contacts/:id`              | 009      | T-INT15                  |
| RF15      | UC12 | `POST /imports`                     | 002, 003 | T-INT13, T-UF08          |
| RF16      | UC15 | job `process-import`                | 002, 003 | T-INT11, T-INT12         |
| RF17      | UC13 | `GET /imports/:id`                  | 002      | T-UF07, T-E2E03          |
| RF18      | UC14 | `GET /imports/:id/errors`           | 002      | T-INT11                  |
| RF19      | UC14 | `GET /imports/:id/errors.csv`       | 002, 009 | T-INT17, T-E2E03         |
| RF20      | UC12 | `GET /imports/template.csv`         | 002      | T-E2E03                  |
| RF21      | UC13 | `GET /imports`                      | 004      | T-UF08                   |
| RF22      | UC12 | `POST /imports?force=true`          | 002      | T-INT12, T-INT14, T-UF08 |
| RF23      | UC13 | `DELETE /imports/:id`               | 009      | T-INT05                  |

## 8.4 Limitações conhecidas e evolução

| Limitação                             | Impacto                          | Evolução proposta                                                     |
| ------------------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| Paginação por offset                  | Lenta em páginas muito profundas | Cursor (keyset) se o volume por usuário crescer em ordens de grandeza |
| Arquivo em `bytea` (≤ 5 MB)           | Limita o tamanho dos uploads     | Object storage (S3/R2) mantendo pg-boss e a transação para o registro |
| Uma consulta de sessão por requisição | Carga extra no banco             | Cache em memória com TTL curto                                        |
| Sem recuperação de senha              | Usuário depende de suporte       | Fluxo por e-mail com token de uso único                               |
| Sem exportação da agenda              | Portabilidade (LGPD) parcial     | `GET /contacts/export.csv`                                            |
| Logs da plataforma podem conter `q`   | Exposição residual de PII        | Busca via `POST /contacts/search` ou configuração de logs do provedor |
