# ADR-003 — Fila de processamento e armazenamento do arquivo

- **Status:** Aceito
- **Data:** 2026-10-23
- **Relacionados:** ADR-002

## Contexto

A importação é assíncrona: a API recebe o arquivo e responde imediatamente; um worker processa depois. É preciso decidir como enfileirar o trabalho e onde o arquivo fica até ser processado, considerando execução local (Docker Compose) e deploy em nuvem.

## Decisão

1. **Fila: pg-boss (PostgreSQL).** O registro da importação, o arquivo e o job são gravados **na mesma transação** (o `send` do pg-boss aceita o executor da transação corrente). O consumo usa `FOR UPDATE SKIP LOCKED`, permitindo múltiplos workers sem disputa.
2. **Worker como entrypoint próprio** do mesmo código da API, com `WORKER_MODE`: `standalone` (processo separado, escalável de forma independente — padrão em produção) ou `embedded` (consumido dentro do processo da API, para ambientes sem serviço de worker, como o plano free do Render). Ver ADR-010.
3. **Arquivo no PostgreSQL (`bytea`)**, em tabela própria (`import_files`), com limite de **5 MB** por upload validado na API. O conteúdo é expurgado ao término do processamento (ADR-009).
4. **Retentativas:** pg-boss com `retryLimit` e backoff; como as linhas são idempotentes (ADR-002), reexecutar um job é seguro.

## Alternativas consideradas

- **BullMQ + Redis:** mais popular e com painel, mas cria _dual write_ (Postgres + Redis) — se o enfileiramento falhar após o commit, a importação fica órfã em `PENDING`, exigindo padrão outbox. Também adiciona um serviço ao deploy.
- **Worker artesanal com SKIP LOCKED:** viável, mas reimplementa retentativa, agendamento e expiração já resolvidos pelo pg-boss.
- **Object storage (S3/MinIO):** mais escalável para arquivos grandes, porém adiciona infraestrutura e outro _dual write_ (upload + registro).
- **Disco local:** incompatível com múltiplas instâncias e com sistemas de arquivos efêmeros de PaaS.

## Consequências

- (+) Atomicidade entre registro, arquivo e job, sem outbox.
- (+) Infraestrutura mínima: apenas PostgreSQL.
- (−) Limite de tamanho de arquivo e carga extra no banco. Caminho de evolução documentado: migrar o conteúdo para object storage mantendo o pg-boss, se o volume crescer.
- (−) Throughput inferior ao Redis — irrelevante para o volume esperado.
