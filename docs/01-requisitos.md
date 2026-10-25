# 1. Requisitos

Este documento traduz o enunciado do desafio em requisitos rastreáveis. Cada item tem um identificador usado nos casos de uso (`02`), na matriz de rastreabilidade (`08`) e nos testes (`09`).

- **RF:** requisito funcional (o que o sistema faz)
- **RN:** regra de negócio (restrições e políticas do domínio)
- **RNF:** requisito não funcional (como o sistema deve se comportar), classificado pelas características da ISO/IEC 25010:2023

Prioridade (MoSCoW): **M** = obrigatório pelo enunciado · **S** = importante, decorrente de decisão técnica · **C** = desejável

---

## 1.1 Escopo

**Dentro do escopo:** autenticação de usuários; agenda de contatos individual por usuário; cadastro, consulta, edição, inativação/reativação, favoritos e eliminação (LGPD) de contatos; importação assíncrona de CSV com acompanhamento e relatório de erros.

**Fora do escopo:** compartilhamento de agendas entre usuários, perfis/papéis administrativos, recuperação de senha por e-mail, exportação completa da agenda, internacionalização da interface, aplicativos móveis nativos.

---

## 1.2 Requisitos funcionais

### Autenticação e acesso
| ID | Requisito | Prio. | Origem |
|---|---|---|---|
| RF01 | O visitante pode criar uma conta informando nome, e-mail e senha. | S | ADR-006 |
| RF02 | O usuário pode autenticar-se com e-mail e senha. | M | Enunciado |
| RF03 | O usuário pode encerrar a sessão atual ou todas as suas sessões. | S | ADR-006 |
| RF04 | Todas as funcionalidades, exceto cadastro e login, exigem usuário autenticado. | M | Enunciado |

### Gerenciamento de contatos
| ID | Requisito | Prio. | Origem |
|---|---|---|---|
| RF05 | Cadastrar contato com nome, e-mail, celular e telefone. | M | Enunciado |
| RF06 | Listar contatos com paginação e ordenação. | M | Enunciado |
| RF07 | Buscar contatos por nome, e-mail ou celular. | M | Enunciado |
| RF08 | Filtrar contatos por favoritos e por status (ativo/inativo). | M | Enunciado |
| RF09 | Visualizar os dados de um contato. | M | Implícito |
| RF10 | Editar os dados de um contato. | M | Enunciado |
| RF11 | Inativar um contato. | M | Enunciado |
| RF12 | Reativar um contato inativo. | M | Enunciado |
| RF13 | Marcar e desmarcar um contato como favorito. | M | Enunciado |
| RF14 | Eliminar definitivamente os dados pessoais de um contato inativo. | S | ADR-009 |

### Importação
| ID | Requisito | Prio. | Origem |
|---|---|---|---|
| RF15 | Enviar arquivo CSV de contatos para importação. | M | Enunciado |
| RF16 | Processar a importação de forma assíncrona. | M | Enunciado |
| RF17 | Acompanhar o status e o progresso de uma importação. | M | Enunciado |
| RF18 | Consultar as linhas com erro e suas justificativas. | M | Enunciado |
| RF19 | Baixar as linhas com erro em CSV, com a coluna de motivo. | C | ADR-002 |
| RF20 | Baixar um CSV modelo. | C | ADR-002 |
| RF21 | Listar o histórico de importações. | S | ADR-004 |
| RF22 | Avisar quando um arquivo idêntico já foi importado e permitir reprocessá-lo mediante confirmação. | M | Enunciado / ADR-002 |
| RF23 | Excluir uma importação e seus dados de erro. | S | ADR-009 |

---

## 1.3 Regras de negócio

| ID | Regra | Origem |
|---|---|---|
| RN01 | **Campos obrigatórios:** nome (2–120 caracteres), e-mail (formato válido, até 254 caracteres) e celular. Telefone fixo é opcional. | ADR-004 |
| RN02 | **Normalização:** celular e telefone são normalizados para E.164 (região padrão BR). O celular deve ser classificado como número móvel. | ADR-001 |
| RN03 | **Unicidade do celular:** o celular é único na agenda de cada usuário, **inclusive entre contatos inativos**. A garantia vale sob concorrência. | ADR-001 |
| RN04 | Ao cadastrar ou editar com celular pertencente a um contato **inativo**, o sistema informa o conflito e oferece a reativação desse contato. | ADR-001 |
| RN05 | O e-mail **não** é único. | ADR-001 |
| RN06 | **Isolamento:** um usuário só acessa os próprios contatos e importações. | ADR-004 |
| RN07 | **Edição concorrente:** uma edição baseada em versão desatualizada é rejeitada, sem sobrescrever a alteração mais recente. | ADR-004 |
| RN08 | Inativar e reativar são operações idempotentes; favoritar e desfavoritar também. | ADR-004 |
| RN09 | **Eliminação** só é permitida para contatos inativos; os dados pessoais são anonimizados e o celular é liberado. Um contato eliminado não pode ser consultado, editado ou reativado. | ADR-009 |
| RN10 | **Arquivo de importação:** CSV de até 5 MB; delimitador `,` ou `;`; codificação UTF-8 (com ou sem BOM) ou Windows-1252; cabeçalho obrigatório com `nome`, `email`, `celular` e coluna opcional `telefone`. | ADR-002/003 |
| RN11 | **Linha já existente:** linha cujo celular já está na agenda (ativo ou inativo) é **ignorada** (`skipped`), sem alterar o contato existente. | ADR-002 |
| RN12 | **Duplicata no arquivo:** a partir da segunda ocorrência de um mesmo celular no arquivo, a linha é rejeitada com erro `DUPLICATE_IN_FILE`. | ADR-002 |
| RN13 | **Reprocessamento:** reenviar o mesmo arquivo (mesmo hash) gera aviso; com confirmação, uma nova importação é processada sem criar duplicados. | ADR-002 |
| RN14 | **Ciclo da importação:** `PENDING → PROCESSING → COMPLETED | COMPLETED_WITH_ERRORS | FAILED`. Cabeçalho inválido leva a `FAILED`. | ADR-002 |
| RN15 | **Retenção:** o conteúdo do arquivo é descartado ao fim do processamento; as linhas com erro são descartadas após 30 dias. | ADR-009 |
| RN16 | O termo de busca não é persistido na URL do navegador. | ADR-009 |

---

## 1.4 Requisitos não funcionais

| ID | Característica (ISO/IEC 25010) | Requisito | Métrica / critério de aceite | Origem |
|---|---|---|---|---|
| RNF01 | Segurança — autenticidade | Autenticação por sessão no servidor com cookie `HttpOnly; Secure; SameSite=Lax`. | Nenhum token acessível via `document.cookie` ou storage. | ADR-006 |
| RNF02 | Segurança — confidencialidade | Senhas com argon2id; IDs de sessão armazenados como hash. | Revisão de código + teste de repositório. | ADR-006 |
| RNF03 | Segurança — integridade | Proteções contra CSRF (SameSite + header obrigatório), XSS (CSP estrita + Trusted Types) e CSV injection. | Testes de integração e e2e específicos. | ADR-006/008/009 |
| RNF04 | Segurança — confidencialidade | Isolamento entre usuários; recurso alheio responde `404`. | Testes de integração com dois usuários. | ADR-004 |
| RNF05 | Segurança — resistência | Rate limit em login e cadastro. | Bloqueio após o limite configurado, com `429`. | ADR-006 |
| RNF06 | Confiabilidade — integridade de dados | Unicidade do celular garantida pelo banco, inclusive entre API e worker. | Teste de concorrência: 20 requisições → 1 × `201`, 19 × `409`. | ADR-001 |
| RNF07 | Confiabilidade — tolerância a falhas | Importação idempotente, com retentativa e retomada segura após falha do worker. | Reprocessamento → `created = 0`; job reexecutado sem duplicar. | ADR-002/003 |
| RNF08 | Confiabilidade — disponibilidade | Deploy sem downtime com health checks; *graceful shutdown*. | `/api/health/ready` verde antes de receber tráfego. | ADR-010 |
| RNF09 | Eficiência de desempenho — tempo | Listagem e busca responsivas. | Meta: p95 < 300 ms na API com 10 mil contatos por usuário (medição com k6). | ADR-005 |
| RNF10 | Eficiência de desempenho — capacidade | Importação de arquivos no limite de tamanho sem degradar a API. | Meta: 10 mil linhas processadas em < 60 s, com a API respondendo durante o processamento. | ADR-002/003 |
| RNF11 | Capacidade de interação — acessibilidade | Conformidade WCAG 2.2 nível AA. | Zero violações axe *serious/critical*; Lighthouse Acessibilidade ≥ 95; navegação completa por teclado. | ADR-008 |
| RNF12 | Capacidade de interação — proteção contra erros | Validação imediata, mensagens claras em português e ações de recuperação (ex.: reativar). | Revisão de UX + testes de componente. | ADR-008 |
| RNF13 | Capacidade de interação — responsividade | Interface utilizável de 320 px a desktop. | Testes e2e em viewport móvel. | ADR-008 |
| RNF14 | Segurança/Privacidade | Adequação técnica à LGPD: minimização, retenção, eliminação, redação de logs. | Checklist do ADR-009 verificado em revisão. | ADR-009 |
| RNF15 | Manutenibilidade — modularidade | Monolito modular por feature; contratos compartilhados. | Sem import cruzado entre módulos (regra de lint). | ADR-007 |
| RNF16 | Manutenibilidade — testabilidade | Domínio sem I/O; testes automatizados em todas as camadas. | Cobertura ≥ 90% no domínio e ≥ 80% global (linhas). | ADR-010 |
| RNF17 | Manutenibilidade — analisabilidade | TypeScript strict, lint e formatação padronizados; logs estruturados com `requestId`. | Pipeline falha com erro de tipo ou lint. | ADR-007/010 |
| RNF18 | Flexibilidade — instalabilidade | Execução local com um comando; deploy declarativo. | `docker compose up` sobe o ambiente; `render.yaml` versionado. | ADR-010 |
| RNF19 | Compatibilidade | Navegadores evergreen (duas últimas versões de Chrome, Edge, Firefox e Safari). | Projetos Playwright em Chromium, Firefox e WebKit. | ADR-008 |
| RNF20 | Manutenibilidade — documentação | API documentada em OpenAPI gerado a partir dos schemas. | `/api/docs` disponível fora de produção; arquivo `openapi.json` versionado. | ADR-007 |

> Metas de desempenho (RNF09, RNF10) são critérios a medir, não resultados já obtidos.
