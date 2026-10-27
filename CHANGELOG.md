# Changelog

Versões do produto (tags `vX.Y.Z`), geradas a partir dos Conventional Commits da `main`. Cada pacote do workspace mantém a própria versão, calculada pelo `pnpm version:bump`.

## [1.0.0](https://github.com/JulianePires/unimed-contact-manager/releases/tag/v1.0.0) — 2026-10-27

Primeira versão publicada em <https://agenda-unimed.onrender.com>.

| Pacote                    | Versão |
| ------------------------- | ------ |
| `@contatos/api`           | 0.11.0 |
| `@contatos/web`           | 0.8.0  |
| `@contatos/contracts`     | 1.3.0  |
| `@contatos/vitest-config` | 1.1.0  |
| `@contatos/eslint-config` | 1.0.0  |
| `@contatos/tsconfig`      | 1.0.0  |

### Funcionalidades

#### API

- Servidor Fastify com rotas de health e tratamento de erros ([#3](https://github.com/JulianePires/unimed-contact-manager/pull/3))
- Schema do banco, migrations e health de prontidão ([#4](https://github.com/JulianePires/unimed-contact-manager/pull/4))
- Autenticação por sessão com cookie httpOnly e CSRF ([#7](https://github.com/JulianePires/unimed-contact-manager/pull/7))
- Cadastro, consulta e busca de contatos ([#8](https://github.com/JulianePires/unimed-contact-manager/pull/8))
- Edição concorrente, status, favorito e eliminação LGPD ([#9](https://github.com/JulianePires/unimed-contact-manager/pull/9))
- Domínio de importação CSV ([#10](https://github.com/JulianePires/unimed-contact-manager/pull/10))
- Envio e consulta de importações com fila transacional ([#11](https://github.com/JulianePires/unimed-contact-manager/pull/11))
- Worker de processamento e relatório de erros ([#12](https://github.com/JulianePires/unimed-contact-manager/pull/12))
- Seed da conta demo e endurecimento de segurança ([#19](https://github.com/JulianePires/unimed-contact-manager/pull/19))

#### Web

- Tokens de tema escuro e componentes base shadcn/ui ([#13](https://github.com/JulianePires/unimed-contact-manager/pull/13))
- Design system, cliente HTTP e layouts ([#14](https://github.com/JulianePires/unimed-contact-manager/pull/14))
- Listagem de contatos com busca, filtros e paginação ([#15](https://github.com/JulianePires/unimed-contact-manager/pull/15))
- Favorito na lista de contatos ([#16](https://github.com/JulianePires/unimed-contact-manager/pull/16))
- Formulário, detalhe e ações de contato ([#17](https://github.com/JulianePires/unimed-contact-manager/pull/17))
- Upload, acompanhamento e erros de importação ([#18](https://github.com/JulianePires/unimed-contact-manager/pull/18))

#### Contratos

- Schemas de autenticação, contatos e importações ([#6](https://github.com/JulianePires/unimed-contact-manager/pull/6))

#### Documentação

- Documentação do projeto e ADRs 001–011 (`f33adac`)
- Estado final, rastreabilidade e limitações ([#22](https://github.com/JulianePires/unimed-contact-manager/pull/22))

### Correções

- Ajustes sugeridos na revisão dos pacotes compartilhados (`21f8d1e`)
- Versão do esbuild com vulnerabilidade (`30f657d`)

### Testes

- Cenários Playwright com axe ([#20](https://github.com/JulianePires/unimed-contact-manager/pull/20))

### CI e infraestrutura

- Pipeline do GitHub Actions e scripts de versão ([#2](https://github.com/JulianePires/unimed-contact-manager/pull/2))
- Imagem Docker, Compose e Blueprint do Render ([#5](https://github.com/JulianePires/unimed-contact-manager/pull/5))
- Render em planos pagos, com o serviço de worker (`22b16c2`, `67be87a`, `c7a5810`)
- Lighthouse CI com massa de carga, cenários k6 e axe estável nos e2e ([#21](https://github.com/JulianePires/unimed-contact-manager/pull/21))

### Manutenção

- Toolchain, workspaces, pacotes compartilhados e Biome (`e8180d6`, `ea161e0`, `cf63c79`, `ede3c73`)
