# 4. Fluxos

Diagramas de sequência dos fluxos com regras não triviais. Fluxos CRUD simples seguem o padrão `rota → caso de uso → repositório` e não são repetidos aqui.

## 4.1 Autenticação e requisição autenticada

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuário
  participant S as SPA
  participant A as API
  participant DB as PostgreSQL

  U->>S: e-mail + senha
  S->>A: POST /api/v1/auth/login<br/>X-Requested-With: fetch
  A->>A: rate limit (IP + e-mail)
  A->>DB: SELECT user BY email
  A->>A: argon2id.verify
  alt credenciais válidas
    A->>A: sid = random(32 bytes)
    A->>DB: INSERT sessions(id_hash = sha256(sid), …)
    A-->>S: 200 + Set-Cookie: __Host-sid=sid #59; HttpOnly #59; Secure #59; SameSite=Lax
    S->>S: invalida query "me" → navega para /contatos
  else inválidas
    A-->>S: 401 INVALID_CREDENTIALS (mensagem genérica)
  end

  Note over S,A: Requisições seguintes
  S->>A: GET /api/v1/contacts (cookie enviado pelo navegador)
  A->>DB: SELECT session BY id_hash WHERE expires_at > now()
  alt sessão válida
    A->>DB: UPDATE last_seen_at (no máx. 1×/min)
    A-->>S: 200 dados
  else inválida/expirada
    A-->>S: 401 → SPA redireciona ao login
  end
```

## 4.2 Cadastro concorrente com o mesmo celular

Duas requisições simultâneas (duas abas, duplo clique ou API + worker) com o mesmo celular. A aplicação **não** consulta antes de inserir: a constraint é a única fonte da verdade.

```mermaid
sequenceDiagram
  autonumber
  participant R1 as Requisição 1
  participant R2 as Requisição 2
  participant A as API (caso de uso)
  participant DB as PostgreSQL

  par
    R1->>A: POST /contacts {mobile: "(81) 99999-0000"}
  and
    R2->>A: POST /contacts {mobile: "81999990000"}
  end
  A->>A: normaliza ambos → +5581999990000
  par
    A->>DB: INSERT … (R1)
  and
    A->>DB: INSERT … (R2)
  end
  DB-->>A: R1 OK
  DB-->>A: R2 ERRO 23505 (contacts_owner_mobile_uq)
  A-->>R1: 201 Created
  A->>DB: SELECT id, deactivated_at BY (owner, mobile)
  A-->>R2: 409 MOBILE_ALREADY_EXISTS {contactId}
  Note over A,DB: Se o existente estiver inativo:<br/>409 MOBILE_BELONGS_TO_INACTIVE_CONTACT<br/>→ SPA oferece "Reativar"
```

## 4.3 Edição com controle de concorrência otimista

```mermaid
sequenceDiagram
  autonumber
  participant T1 as Aba 1
  participant T2 as Aba 2
  participant A as API
  participant DB as PostgreSQL

  T1->>A: GET /contacts/42
  A-->>T1: 200 ETag: "v3"
  T2->>A: GET /contacts/42
  A-->>T2: 200 ETag: "v3"
  T1->>A: PATCH /contacts/42 If-Match: "v3"
  A->>DB: UPDATE … SET version = 4 WHERE id = 42 AND version = 3
  DB-->>A: 1 linha
  A-->>T1: 200 ETag: "v4"
  T2->>A: PATCH /contacts/42 If-Match: "v3"
  A->>DB: UPDATE … WHERE id = 42 AND version = 3
  DB-->>A: 0 linhas
  A-->>T2: 412 CONTACT_MODIFIED
  T2->>T2: avisa e oferece recarregar
```

## 4.4 Importação: envio

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuário
  participant S as SPA
  participant A as API
  participant DB as PostgreSQL (dados + pg-boss)

  U->>S: seleciona contatos.csv
  S->>S: valida tamanho ≤ 5 MB e extensão (UX)
  S->>A: POST /api/v1/imports (multipart)
  A->>A: stream → buffer (limite 5 MB) + SHA-256
  A->>DB: SELECT import BY (owner, sha256) ORDER BY created_at DESC LIMIT 1
  alt já importado e sem force=true
    A-->>S: 409 IMPORT_ALREADY_EXISTS {importId, createdAt}
    S->>U: "Arquivo já importado em …" [Ver anterior] [Importar novamente]
    U->>S: Importar novamente
    S->>A: POST /api/v1/imports?force=true
  end
  rect rgb(238, 242, 255)
    Note over A,DB: Uma transação
    A->>DB: INSERT imports (PENDING)
    A->>DB: INSERT import_files (bytea)
    A->>DB: boss.send('process-import', {importId}) no mesmo executor
  end
  A-->>S: 202 Accepted {id} + Location
  S->>S: navega para /importacoes/:id
```

## 4.5 Importação: processamento (worker)

```mermaid
sequenceDiagram
  autonumber
  participant W as Worker
  participant DB as PostgreSQL

  W->>DB: fetch job (FOR UPDATE SKIP LOCKED)
  W->>DB: UPDATE imports SET status = PROCESSING, started_at
  W->>DB: SELECT content FROM import_files
  W->>W: detecta BOM, encoding (UTF-8/Win-1252), delimitador (, ;)
  W->>W: valida cabeçalho
  alt cabeçalho inválido
    W->>DB: UPDATE imports SET status = FAILED, failure_reason
  else válido
    loop lote de 500 linhas (stream csv-parse)
      W->>W: valida + normaliza cada linha (domínio de contacts)
      W->>W: detecta celular repetido no arquivo (Set em memória)
      W->>DB: BEGIN
      W->>DB: INSERT contacts … ON CONFLICT (owner_id, mobile_e164) DO NOTHING RETURNING mobile_e164
      W->>W: inseridas → created · válidas não retornadas → skipped
      W->>DB: INSERT import_errors (linhas inválidas)
      W->>DB: UPDATE imports SET processed/created/skipped/failed
      W->>DB: COMMIT
    end
    W->>DB: UPDATE imports SET status = COMPLETED | COMPLETED_WITH_ERRORS, finished_at
    W->>DB: DELETE FROM import_files WHERE import_id
  end
  Note over W,DB: Falha no meio → pg-boss reexecuta com backoff.<br/>Lotes já gravados geram "skipped" na nova tentativa: sem duplicados.
```

> **Retomada após falha (checkpoint):** cada lote grava contatos, erros e contadores na **mesma transação**, então `processed_rows` é um checkpoint confiável. Numa retentativa, o worker relê o arquivo, reconstrói o conjunto de celulares já vistos (para manter a detecção de `DUPLICATE_IN_FILE`) e retoma a partir da linha `processed_rows + 1`. Se a falha ocorrer entre o `INSERT` e o `COMMIT`, o lote inteiro sofre rollback e é refeito. Os contadores ficam exatos e o `ON CONFLICT` continua como rede de segurança (caso T-INT12 da estratégia de testes).

## 4.6 Acompanhamento da importação (front)

```mermaid
sequenceDiagram
  autonumber
  participant P as Página da importação
  participant Q as TanStack Query
  participant A as API

  P->>Q: useQuery(['import', id], refetchInterval)
  loop a cada 2 s enquanto status ∉ {COMPLETED, COMPLETED_WITH_ERRORS, FAILED}
    Q->>A: GET /api/v1/imports/:id
    A-->>Q: {status, total, processed, created, skipped, failed}
    Q-->>P: atualiza progressbar
    P->>P: useEffectEvent → anuncia marcos (25/50/75/100%) em aria-live
  end
  Note over P: Ao sair da página, a query fica sem observadores:<br/>o polling para
  P->>Q: status terminal → refetchInterval = false
  P->>A: GET /imports/:id/errors?page=1 (se failed > 0)
```

## 4.7 Favoritar com atualização otimista

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuário
  participant C as ContactRow
  participant A as API

  U->>C: clica na estrela
  C->>C: startTransition → setOptimisticFavorite(true)
  C->>A: PUT /api/v1/contacts/:id/favorite
  alt sucesso
    A-->>C: 204
    C->>C: invalida ['contacts'] → estado real = otimista
  else falha
    A-->>C: erro
    C->>C: transição termina → useOptimistic volta ao valor real
    C->>U: anuncia "Não foi possível favoritar Maria Silva"
  end
```

## 4.8 Eliminação de dados (LGPD)

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuário
  participant S as SPA
  participant A as API
  participant DB as PostgreSQL

  U->>S: "Excluir definitivamente" (contato inativo)
  S->>U: diálogo de confirmação (irreversível)
  U->>S: confirma
  S->>A: DELETE /api/v1/contacts/:id
  A->>DB: UPDATE contacts SET name = 'Contato removido', email = NULL,<br/>mobile_e164 = NULL, phone_e164 = NULL, anonymized_at = now()<br/>WHERE id AND owner_id AND deactivated_at IS NOT NULL AND anonymized_at IS NULL
  alt 1 linha
    A-->>S: 204
  else contato ativo
    A-->>S: 409 CONTACT_MUST_BE_INACTIVE
  else inexistente/já eliminado
    A-->>S: 404
  end
```

## 4.9 Ciclos de vida

### Contato

```mermaid
stateDiagram-v2
  [*] --> Ativo: cadastrar / importar
  Ativo --> Inativo: inativar
  Inativo --> Ativo: reativar
  Inativo --> Eliminado: eliminar (LGPD)
  Ativo --> Ativo: editar · (des)favoritar
  Inativo --> Inativo: editar · (des)favoritar
  Eliminado --> [*]
```

### Importação

```mermaid
stateDiagram-v2
  [*] --> PENDING: upload aceito
  PENDING --> PROCESSING: worker reserva o job
  PROCESSING --> COMPLETED: sem erros
  PROCESSING --> COMPLETED_WITH_ERRORS: ≥ 1 linha rejeitada
  PROCESSING --> FAILED: cabeçalho inválido / retentativas esgotadas
  PROCESSING --> PROCESSING: retentativa após falha
  COMPLETED --> [*]
  COMPLETED_WITH_ERRORS --> [*]
  FAILED --> [*]
```
