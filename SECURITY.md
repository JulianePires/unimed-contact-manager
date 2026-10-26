# Política de segurança

A Agenda Unimed trata dados pessoais de terceiros (nome, e-mail e telefones de contatos). Levamos a sério qualquer relato que ajude a protegê-los.

## Versões suportadas

| Versão                                       | Suporte          |
| -------------------------------------------- | ---------------- |
| `main` e o ambiente publicado a partir dela  | ✅ Corrigida     |
| Branches de funcionalidade e versões antigas | ❌ Sem correções |

## Como reportar uma vulnerabilidade

**Não abra issue, discussão ou PR público** para relatar uma vulnerabilidade.

Use o reporte privado do GitHub: [Security → Report a vulnerability](https://github.com/JulianePires/unimed-contact-manager/security/advisories/new). Só as pessoas mantenedoras veem o relato.

Inclua, sempre que possível:

- componente afetado (API, SPA, imagem Docker, configuração de deploy) e versão ou commit;
- passos para reproduzir, requisições de exemplo ou prova de conceito;
- impacto esperado (ex.: acesso a contatos de outro usuário, sequestro de sessão);
- sugestão de correção, se houver.

## O que esperar

| Etapa                          | Meta                    |
| ------------------------------ | ----------------------- |
| Confirmação de recebimento     | até 5 dias úteis        |
| Avaliação inicial e severidade | até 10 dias úteis       |
| Correção de severidade crítica | até 7 dias após triagem |
| Correção de severidade alta    | até 30 dias             |
| Severidade média ou baixa      | próxima versão          |

Mantemos você informado durante a correção. Após a publicação da correção, divulgamos um aviso de segurança (GitHub Security Advisory) e damos crédito a quem reportou, se desejar.

## Escopo

**Dentro do escopo:** código deste repositório: API (`apps/api`), SPA (`apps/web`), pacotes compartilhados (`packages/*`), `Dockerfile`, `docker-compose.yml`, `render.yaml` e o pipeline de CI.

**Fora do escopo:**

- infraestrutura do Render, do GitHub ou de outros provedores (reporte diretamente a eles);
- negação de serviço por volume, spam ou testes de carga;
- engenharia social, phishing ou acesso físico;
- relatórios de scanners automáticos sem demonstração de impacto;
- vulnerabilidades em dependências já corrigidas por atualização pendente do Renovate.

## Pesquisa de boa-fé

Não tomaremos medidas contra pesquisa feita de boa-fé que:

- use apenas contas criadas pela própria pessoa pesquisadora;
- não acesse, altere nem retenha dados de outros usuários além do mínimo para demonstrar o problema;
- não degrade o serviço para outros usuários;
- dê tempo razoável para a correção antes de qualquer divulgação pública.

## Medidas de segurança adotadas

| Tema               | Medida                                                                                                               | Referência                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Autenticação       | Sessão no servidor; ID de 32 bytes aleatórios, apenas o SHA-256 no banco; expiração por inatividade e absoluta       | [ADR-006](docs/adr/ADR-006-autenticacao.md)                       |
| Cookie             | `__Host-sid; HttpOnly; Secure; SameSite=Lax; Path=/`                                                                 | [ADR-006](docs/adr/ADR-006-autenticacao.md)                       |
| Senhas             | argon2id; login em tempo constante e mensagem genérica (não revela e-mails cadastrados)                              | [ADR-006](docs/adr/ADR-006-autenticacao.md)                       |
| Força bruta        | Rate limit por IP (cadastro e login) e por conta (login)                                                             | [ADR-006](docs/adr/ADR-006-autenticacao.md)                       |
| CSRF               | `SameSite=Lax` + header `X-Requested-With: fetch` obrigatório em mutações                                            | [ADR-006](docs/adr/ADR-006-autenticacao.md)                       |
| XSS e cabeçalhos   | CSP estrita com Trusted Types, HSTS, `frame-ancestors 'none'` via `@fastify/helmet`                                  | [ADR-008](docs/adr/ADR-008-frontend.md)                           |
| Isolamento         | Toda consulta filtra pelo dono; recurso de outro usuário responde `404`                                              | [ADR-004](docs/adr/ADR-004-modelo-de-dados-e-api.md)              |
| Privacidade (LGPD) | Anonimização, retenção limitada, redação de dados pessoais em logs, proteção contra CSV injection                    | [ADR-009](docs/adr/ADR-009-lgpd-e-privacidade.md)                 |
| Erros              | Problem Details sem detalhes internos; erros inesperados viram `500` com `requestId`                                 | [docs/05 §5.2](docs/05-api.md#52-erros)                           |
| Dependências       | Versões fixadas, Renovate, `pnpm audit --audit-level=high` no CI e scripts de instalação só para pacotes autorizados | [ADR-011](docs/adr/ADR-011-toolchain-e-versoes.md)                |
| Segredos           | Configuração só por variáveis de ambiente; `.env` fora do Git; varredura com gitleaks no CI                          | [ADR-010](docs/adr/ADR-010-testes-ci-e-deploy.md)                 |
| Execução           | Imagem Docker com usuário sem privilégios; banco acessível só pela rede interna do Render                            | [`Dockerfile`](apps/api/Dockerfile), [`render.yaml`](render.yaml) |
