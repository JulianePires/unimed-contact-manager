# ADR-006 — Autenticação com sessão no servidor e cookie httpOnly

- **Status:** Aceito
- **Data:** 2026-10-23
- **Relacionados:** ADR-003, ADR-004, ADR-010

## Contexto

Somente usuários autenticados acessam o sistema, e cada usuário possui sua própria agenda. O front (SPA React) e a API são servidos pela **mesma origem**: o próprio serviço Fastify entrega o build do React em `/` e a API em `/api` (ADR-010). Portanto, cookies são first-party e não há CORS.

## Decisão

### Sessão

- Sessões persistidas no **PostgreSQL** (coerente com a infraestrutura "só Postgres" do ADR-003):
  `sessions (id_hash PK, user_id → users, created_at, last_seen_at, expires_at, user_agent, ip)`.
- O identificador é um valor opaco aleatório (32 bytes). No banco é guardado **apenas o hash SHA-256**, de modo que um vazamento da tabela não entrega sessões válidas.
- **Expiração:** inatividade de 2 h (renovação deslizante, com `last_seen_at` atualizado no máximo uma vez por minuto) e limite absoluto de 7 dias.
- **Novo ID a cada login** (proteção contra _session fixation_).
- **Logout** apaga a sessão: revogação imediata. `POST /auth/logout-all` encerra todas as sessões do usuário.

### Cookie

`__Host-sid=<id>; HttpOnly; Secure; SameSite=Lax; Path=/`

- `HttpOnly`: inacessível a JavaScript, portanto não exfiltrável por XSS.
- Prefixo `__Host-`: impede que subdomínios sobrescrevam o cookie. Em desenvolvimento local, o nome é configurável via variável de ambiente.

### CSRF (defesa em profundidade)

- `SameSite=Lax` impede o envio do cookie em POST cross-site.
- Toda mutação (`POST`, `PUT`, `PATCH`, `DELETE`) exige o header `X-Requested-With: fetch`. Formulários HTML não conseguem definir headers customizados, e cross-origin isso dispara um preflight que a API não autoriza. Relevante porque `multipart/form-data` (upload de importação) é um content-type "simples" que um `<form>` malicioso consegue enviar.

### Fluxos

- `POST /auth/register` (auto-cadastro), `POST /auth/login`, `POST /auth/logout`, `POST /auth/logout-all`, `GET /auth/me`.
- Usuário **demo** criado por seed, para avaliação rápida.
- O front consulta `/auth/me` ao carregar. Um `401` em qualquer chamada redireciona para o login.

### Proteções adicionais

- Senhas com **argon2id**.
- Rate limit em login e cadastro (`@fastify/rate-limit`).
- Mensagem genérica em falha de login (não revela se o e-mail existe).
- Limpeza periódica de sessões expiradas (job agendado no pg-boss).

## Alternativas consideradas

- **JWT em `localStorage`:** exfiltrável por XSS e sem revogação. Rejeitado.
- **JWT access + refresh em cookie:** viável, mas adiciona rotação, detecção de reuso e coordenação entre abas para resolver um problema (validação sem estado em serviços distribuídos) que esta aplicação, uma SPA com a própria API, não tem. O logout também não invalida o access token já emitido.
- **Provedor externo (Cognito/Auth0):** reduz código próprio, mas tira do escopo avaliado a modelagem de segurança.

## Consequências

- (+) Revogação real e imediata (logout, logout global, bloqueio de usuário).
- (+) Token nunca exposto ao JavaScript.
- (+) Front mais simples: sem interceptor de refresh nem armazenamento de token.
- (−) Uma consulta ao banco por requisição autenticada (busca por PK; cache em memória é a evolução possível).
- (−) Exige front e API na mesma origem. Restrição atendida pela topologia de deploy (ADR-010).
