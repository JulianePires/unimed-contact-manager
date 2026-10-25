# ADR-009 — Privacidade e adequação à LGPD

- **Status:** Aceito
- **Data:** 2026-10-23
- **Relacionados:** ADR-001, ADR-002, ADR-003, ADR-004, ADR-008

> Este registro descreve medidas técnicas de engenharia. Não substitui avaliação jurídica nem a definição formal de papéis (controlador/operador) e bases legais.

## Contexto

O sistema trata dados pessoais de terceiros (nome, e-mail, celular e telefone dos contatos) e dos próprios usuários. A Lei 13.709/2018 (LGPD) estabelece, entre outros, os princípios de finalidade, necessidade e segurança (art. 6º), os direitos do titular, incluindo a eliminação (art. 18), os limites de conservação (arts. 15 e 16) e o dever de adotar medidas de segurança (art. 46).

Algumas decisões anteriores entram em tensão com esses pontos:

- inativar (ADR-004) não elimina dados;
- filtros na URL (ADR-008) poderiam expor dados pessoais;
- a importação (ADR-002/003) mantém cópias de dados pessoais.

## Decisão

### 1. Eliminação por anonimização

- `DELETE /contacts/:id` executa a **eliminação dos dados pessoais**, permitida apenas para contatos **inativos** (caso contrário, `409 CONTACT_MUST_BE_INACTIVE`). O front exige confirmação explícita, com o nome do contato digitado ou um diálogo claro de irreversibilidade.
- A linha é mantida com `anonymized_at` preenchido; `name` é substituído por um marcador fixo e `email`, `mobile_e164` e `phone_e164` passam a `NULL`.
- Como o PostgreSQL trata `NULL`s como distintos em `UNIQUE`, o **celular é liberado** para novo cadastro, resolvendo também o caso de número reciclado (ADR-001).
- Constraint: `CHECK (anonymized_at IS NOT NULL OR (email IS NOT NULL AND mobile_e164 IS NOT NULL))`.
- Contatos anonimizados não aparecem na listagem nem podem ser reativados ou editados.

### 2. Minimização em URLs e logs

- O termo de busca `q` **não é colocado na URL do front** (não vai para o histórico do navegador nem para links compartilhados). Filtros não pessoais (`page`, `status`, `favorite`, `sort`) permanecem na URL.
- A API recebe `q` em query string, mas os logs aplicam **redação**: `pino` `redact` para corpo, headers sensíveis e o parâmetro `q`. Os logs de requisição da plataforma de hospedagem devem ser avaliados quanto ao registro de query string (risco residual documentado).
- Erros e telemetria nunca incluem dados de contato.

### 3. Retenção da importação

- O conteúdo do arquivo (`import_files`) é **expurgado ao término** do processamento.
- As linhas com erro (`import_errors.raw`) são expurgadas após **30 dias** por job agendado. Os metadados (contadores, status e datas) são mantidos.
- O usuário pode excluir uma importação e seus erros a qualquer momento.

### 4. Dados no navegador

- Nenhum dado de contato em `localStorage`, `sessionStorage` ou IndexedDB. O cache existe apenas em memória e é limpo no logout.
- Único cookie: sessão, estritamente necessário (ADR-006). Sem cookies de analytics ou terceiros.

### 5. Segurança (art. 46)

- Senhas com argon2id; IDs de sessão armazenados como hash; HTTPS obrigatório; CSP estrita.
- Isolamento por `owner_id` em todas as consultas, com `404` para recursos de outros usuários.
- **Prevenção de CSV injection** no download de erros: células iniciadas por `=`, `+`, `-`, `@`, tab ou CR recebem prefixo `'`.

### 6. Transparência

- Aviso de privacidade na tela de cadastro, descrevendo finalidade, dados tratados, retenção e direitos.
- Direitos de acesso e correção atendidos pelas próprias funcionalidades de consulta e edição. A portabilidade por exportação CSV fica registrada como evolução.

## Alternativas consideradas

- **Exclusão física:** mais simples, mas perde trilha mínima de auditoria (quando a eliminação ocorreu) e exigiria cascatas futuras.
- **Apenas documentar:** deixaria uma lacuna conhecida num sistema cuja razão de existir é tratar dados pessoais.
- **Busca na URL:** conveniente para compartilhar, mas expõe dados pessoais no histórico e em logs intermediários.

## Consequências

- (+) Direito de eliminação atendido sem violar a regra de unicidade nem a integridade.
- (+) Exposição de dados pessoais reduzida em URLs, logs e cópias temporárias.
- (−) `email` e `mobile_e164` deixam de ser `NOT NULL` simples e passam a depender da constraint condicional.
- (−) Job adicional de expurgo e configuração de redação em logs.
