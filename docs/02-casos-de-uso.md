# 2. Casos de uso

## 2.1 Atores

| Ator | Tipo | Descrição |
|---|---|---|
| **Visitante** | Primário | Pessoa não autenticada. Pode criar conta e autenticar-se. |
| **Usuário autenticado** | Primário | Especialização do Visitante. Dono de uma agenda de contatos individual. |
| **Worker de importação** | Secundário (sistema) | Processo assíncrono que consome a fila e processa arquivos CSV. |
| **Agendador** | Secundário (tempo) | Gatilho temporal do pg-boss para rotinas de retenção e limpeza. |

## 2.2 Diagrama

![Diagrama de casos de uso](diagramas/casos-de-uso.svg)

> Fonte: [`diagramas/casos-de-uso.puml`](diagramas/casos-de-uso.puml) (PlantUML). O SVG é gerado a partir da fonte e versionado junto.

## 2.3 Índice e rastreabilidade

| UC | Nome | Ator | Requisitos |
|---|---|---|---|
| UC01 | Criar conta | Visitante | RF01 |
| UC02 | Autenticar-se | Visitante | RF02, RF04, RNF05 |
| UC03 | Encerrar sessão | Usuário | RF03 |
| UC04 | Cadastrar contato | Usuário | RF05, RN01–RN05, RNF06 |
| UC05 | Consultar contatos | Usuário | RF06–RF08, RN16 |
| UC06 | Visualizar contato | Usuário | RF09, RN06 |
| UC07 | Editar contato | Usuário | RF10, RN01–RN04, RN07 |
| UC08 | Inativar contato | Usuário | RF11, RN08 |
| UC09 | Reativar contato | Usuário | RF12, RN04, RN08 |
| UC10 | Favoritar/desfavoritar contato | Usuário | RF13, RN08 |
| UC11 | Eliminar dados de contato | Usuário | RF14, RN09 |
| UC12 | Importar contatos via CSV | Usuário | RF15, RF16, RF20, RF22, RN10, RN13 |
| UC13 | Acompanhar importação | Usuário | RF17, RF21, RF23 |
| UC14 | Consultar linhas com erro | Usuário | RF18, RF19 |
| UC15 | Processar importação | Worker | RF16, RN11, RN12, RN14, RNF07 |
| UC16 | Expurgar dados retidos | Agendador | RN15 |

---

## 2.4 Especificações

Convenções: **FP** = fluxo principal · **FA** = fluxo alternativo · **FE** = fluxo de exceção. Toda operação de usuário autenticado pressupõe sessão válida; sessão inválida ou expirada leva ao FE global *"redirecionar para UC02"*.

### UC01 — Criar conta
- **Pré-condição:** visitante não autenticado.
- **FP:**
  1. O visitante acessa "Criar conta".
  2. O sistema exibe o formulário (nome, e-mail, senha) e o aviso de privacidade.
  3. O visitante preenche e envia.
  4. O sistema valida, armazena a senha com argon2id, cria a sessão e redireciona para a lista de contatos.
- **FE1 — e-mail já cadastrado:** o sistema exibe mensagem genérica de que não foi possível concluir o cadastro, sem confirmar a existência do e-mail.
- **FE2 — limite de tentativas:** `429`, com orientação para tentar mais tarde.
- **Pós-condição:** usuário criado e autenticado.

### UC02 — Autenticar-se
- **FP:** o visitante informa e-mail e senha → o sistema valida, gera um novo ID de sessão, grava o cookie `HttpOnly` e redireciona para a rota de origem ou para a lista.
- **FE1 — credenciais inválidas:** mensagem genérica "E-mail ou senha inválidos".
- **FE2 — limite de tentativas:** `429`.
- **Pós-condição:** sessão ativa (2 h de inatividade, 7 dias de limite absoluto).

### UC03 — Encerrar sessão
- **FP:** o usuário aciona "Sair" → o sistema remove a sessão, limpa o cookie, limpa o cache do front e redireciona ao login.
- **FA1 — sair de todos os dispositivos:** todas as sessões do usuário são removidas.

### UC04 — Cadastrar contato
- **Pré-condição:** usuário autenticado.
- **FP:**
  1. O usuário aciona "Novo contato".
  2. O sistema exibe o formulário (nome\*, e-mail\*, celular\*, telefone).
  3. O usuário preenche; o sistema valida cada campo ao sair dele (schema compartilhado).
  4. O usuário envia.
  5. O sistema **inclui "Validar e normalizar"** (E.164, tipo móvel), grava o contato e responde `201`.
  6. O sistema exibe confirmação e o contato na lista.
- **FA1 — celular de contato ativo:** `409 MOBILE_ALREADY_EXISTS`; o campo celular é marcado com erro e link para o contato existente.
- **FA2 — celular de contato inativo:** `409 MOBILE_BELONGS_TO_INACTIVE_CONTACT`; o sistema oferece **"Reativar contato"** (**extend UC09**). Ao reativar, o formulário é descartado e o contato reativado é exibido.
- **FE1 — dados inválidos:** `422`, com erros por campo; o foco vai para o resumo de erros.
- **FE2 — envio simultâneo do mesmo celular:** a constraint do banco aceita apenas uma gravação; as demais recebem FA1/FA2.
- **Pós-condição:** contato ativo, não favorito, `version = 1`.

### UC05 — Consultar contatos
- **FP:**
  1. O usuário acessa a lista.
  2. O sistema exibe a primeira página de contatos **ativos**, ordenada por nome, com total de registros e de páginas.
  3. O usuário navega entre páginas ou muda o tamanho da página.
- **Extensão "Buscar":** o usuário digita um termo (mínimo 2 caracteres). Após 300 ms sem digitação, o sistema aplica a busca: só dígitos → celular; contém `@` → e-mail; demais → nome ou e-mail, sem diferenciar acentos e maiúsculas. O termo **não** é gravado na URL.
- **Extensão "Filtrar":** o usuário filtra por status (ativos, inativos, todos) e/ou favoritos. Filtros, página e ordenação ficam na URL.
- **FA1 — nenhum resultado:** estado vazio com sugestão de limpar filtros ou cadastrar.
- **Pós-condição:** nenhuma alteração de dados.

### UC06 — Visualizar contato
- **FP:** o usuário seleciona um contato → o sistema exibe os dados formatados, status, favorito e datas.
- **Extensão UC09:** se o contato está inativo, exibe a ação "Reativar".
- **FE1 — contato inexistente, de outro usuário ou eliminado:** `404`, com tela "Contato não encontrado".

### UC07 — Editar contato
- **Pré-condição:** contato ativo ou inativo (não eliminado).
- **FP:**
  1. O usuário aciona "Editar".
  2. O sistema exibe o formulário preenchido e guarda a versão (`ETag`).
  3. O usuário altera e envia (`PATCH` com `If-Match`).
  4. O sistema **inclui "Validar e normalizar"**, atualiza e incrementa a versão.
- **FA1/FA2:** iguais ao UC04, quando o celular muda para um número já existente.
- **FE1 — alteração concorrente:** `412 CONTACT_MODIFIED`; o sistema avisa que o contato foi alterado em outra sessão e oferece recarregar os dados atuais (as alterações locais permanecem visíveis para cópia).
- **Pós-condição:** dados atualizados; `version` incrementada.

### UC08 — Inativar contato
- **FP:** o usuário aciona "Inativar" → o sistema pede confirmação → grava `deactivated_at` → o contato sai da lista de ativos com opção "Desfazer" (que executa UC09).
- **FA1 — já inativo:** operação idempotente; responde com o estado atual.
- **Pós-condição:** contato inativo; o celular continua reservado (RN03).

### UC09 — Reativar contato
- **FP:** o usuário aciona "Reativar" → o sistema limpa `deactivated_at`.
- **FA1 — já ativo:** idempotente.
- **FE1 — contato eliminado:** `404`.

### UC10 — Favoritar/desfavoritar contato
- **FP:** o usuário aciona a estrela → a interface muda imediatamente (atualização otimista) → o sistema grava (`PUT` ou `DELETE /favorite`).
- **FE1 — falha na requisição:** a interface volta ao estado anterior e anuncia o erro (região `aria-live`).
- **Pós-condição:** `is_favorite` atualizado; operação idempotente.

### UC11 — Eliminar dados de contato (LGPD)
- **Pré-condição:** contato inativo.
- **FP:**
  1. O usuário aciona "Excluir definitivamente".
  2. O sistema explica a irreversibilidade e pede confirmação explícita.
  3. O sistema anonimiza: nome substituído por marcador; e-mail, celular e telefone nulos; `anonymized_at` preenchido.
  4. O contato deixa de aparecer em consultas; o celular fica disponível.
- **FE1 — contato ativo:** `409 CONTACT_MUST_BE_INACTIVE`; a interface orienta inativar primeiro.

### UC12 — Importar contatos via CSV
- **FP:**
  1. O usuário acessa "Importar" (opcionalmente baixa o CSV modelo).
  2. Seleciona ou arrasta um arquivo.
  3. O sistema valida tamanho (≤ 5 MB) e extensão no cliente.
  4. O sistema recebe o arquivo, calcula o SHA-256 e, **na mesma transação**, grava a importação (`PENDING`), o conteúdo do arquivo e o job na fila.
  5. Responde `202` com o ID; o usuário é levado ao acompanhamento (UC13).
- **FA1 — arquivo já importado:** a API responde `409 IMPORT_ALREADY_EXISTS` com a importação anterior; o sistema exibe "Este arquivo já foi importado em <data>" com opções "Ver importação anterior" e "Importar novamente". Ao confirmar, reenvia com `force=true`.
- **FE1 — arquivo inválido (tamanho/tipo):** `413` ou `415`, com mensagem.
- **Pós-condição:** importação `PENDING` e job enfileirado (**dispara UC15**).

### UC13 — Acompanhar importação
- **FP:** o sistema exibe status, barra de progresso e contadores (`total`, `processed`, `created`, `skipped`, `failed`), atualizados por polling a cada 2 s enquanto o status não for terminal. Mudanças relevantes são anunciadas por leitor de tela.
- **FA1 — histórico:** o usuário lista importações anteriores com status e data.
- **FA2 — excluir importação:** remove a importação e seus erros (RF23).
- **Pós-condição:** nenhuma alteração de contatos.

### UC14 — Consultar linhas com erro
- **FP:** o sistema lista, paginadas, as linhas rejeitadas: número da linha, dados originais e motivos por campo.
- **Extensão "Baixar CSV de erros":** gera um CSV com as linhas originais e a coluna `motivo`, com células neutralizadas contra fórmulas.
- **FA1 — erros expurgados (> 30 dias):** o sistema informa que os detalhes não estão mais disponíveis; os contadores permanecem.

### UC15 — Processar importação (Worker)
- **Gatilho:** job disponível na fila.
- **FP:**
  1. O worker reserva o job (`SKIP LOCKED`) e muda a importação para `PROCESSING`.
  2. Detecta codificação, BOM e delimitador; valida o cabeçalho.
  3. Lê o arquivo em fluxo, em lotes de 500 linhas. Para cada linha: **inclui "Validar e normalizar"**, detecta duplicata no arquivo e prepara a inserção.
  4. Executa `INSERT ... ON CONFLICT DO NOTHING` por lote; classifica as linhas em `created`/`skipped`; grava os erros; atualiza os contadores.
  5. Ao final, define `COMPLETED` ou `COMPLETED_WITH_ERRORS` e descarta o conteúdo do arquivo.
- **FE1 — cabeçalho inválido:** `FAILED` com motivo.
- **FE2 — falha inesperada:** retentativa com backoff, retomando do checkpoint `processed_rows`; como a inserção é idempotente, nada é duplicado. Esgotadas as tentativas, `FAILED`.

### UC16 — Expurgar dados retidos (Agendador)
- **Gatilho:** diário.
- **FP:** remove `import_errors.raw` com mais de 30 dias e sessões expiradas; registra a quantidade expurgada em log (sem dados pessoais).
