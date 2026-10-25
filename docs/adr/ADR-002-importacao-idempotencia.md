# ADR-002 — Importação CSV: idempotência e tratamento de linhas

- **Status:** Aceito
- **Data:** 2026-10-23
- **Relacionados:** ADR-001, ADR-003

## Contexto

A importação de contatos via CSV deve ser assíncrona, permitir acompanhar status, listar linhas com erro e suas justificativas, e garantir que o reprocessamento de um mesmo arquivo não gere duplicados.

## Decisão

### Idempotência em duas camadas

1. **Arquivo (UX):** hash SHA-256 do conteúdo, por usuário. Ao reenviar um arquivo já importado, a API responde `409 IMPORT_ALREADY_EXISTS` (com `importId` e `importedAt`) e o front pede confirmação. Confirmado, o reenvio com `force=true` cria e processa uma nova importação.
2. **Linha (garantia):** `INSERT ... ON CONFLICT (owner_id, mobile_e164) DO NOTHING RETURNING id`. A não duplicação é garantida pela mesma constraint do ADR-001, não pelo hash. Reprocessar um lote após falha do worker também é seguro.
3. **Checkpoint:** cada lote grava contatos, erros e contadores na mesma transação; uma retentativa retoma a partir de `processed_rows`, mantendo os contadores exatos.

### Regras por linha

- **Linha válida e nova** → `created`.
- **Celular já existente na agenda (ativo ou inativo)** → `skipped` (não é erro). O CSV não sobrescreve dados editados pelo usuário nem reativa contatos inativos.
- **Celular repetido no mesmo arquivo** → a segunda ocorrência vira erro `DUPLICATE_IN_FILE`, referenciando a linha original.
- **Dados inválidos** → erro com lista por campo (`field`, `code`, `message`).

### Robustez de entrada

- Detecção de BOM, delimitador (`,` ou `;`) e encoding (UTF-8 ou Windows-1252 via `iconv-lite`), cobrindo exportações do Excel em pt-BR.
- Cabeçalho validado antes do processamento; colunas obrigatórias ausentes → importação `FAILED` com motivo.
- CSV modelo disponível para download.

### Ciclo de vida

`PENDING → PROCESSING → COMPLETED | COMPLETED_WITH_ERRORS | FAILED`, com contadores `total`, `processed`, `created`, `skipped`, `failed`.

### Erros consultáveis

Tabela `import_errors (import_id, line_number, raw jsonb, errors jsonb)`, exposta por endpoint paginado e por download em CSV (linhas originais + coluna de motivo), para correção e reenvio.

### Acompanhamento

Polling no front (React Query `refetchInterval`) enquanto o status não for terminal.

## Alternativas consideradas

- **Atualizar contato existente (upsert `DO UPDATE`):** sobrescreveria edições manuais; rejeitado.
- **Idempotência estrita por hash (mesmo arquivo = mesmo resultado):** impede reprocessar após corrigir dados na agenda; rejeitado em favor de aviso + confirmação.
- **SSE/WebSocket para progresso:** complexidade desproporcional ao ganho; polling é suficiente.

## Consequências

- (+) Reprocessamento seguro em qualquer ponto, inclusive após crash.
- (+) Resultado transparente: criados, ignorados e erros justificados.
- (−) Mais de uma importação pode existir para o mesmo hash (histórico intencional).
