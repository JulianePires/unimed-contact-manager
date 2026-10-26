# Como contribuir

## Fluxo

1. Crie uma branch a partir da `main` (`feature/…`, `fix/…`, `chore/…`).
2. Leia os documentos e ADRs relacionados à mudança. Se o código precisar divergir de uma decisão registrada, discuta antes e registre a nova decisão num ADR.
3. Faça commits pequenos e coesos (veja os limites abaixo) e abra um PR para a `main`.
4. O PR é integrado por _squash merge_: o título vira a mensagem do commit na `main` e segue as mesmas regras de commit.

## Commits

- **Conventional Commits**, validados pelo commitlint (hook `commit-msg` e CI). Escopos: `api`, `web`, `contracts`, `tsconfig`, `docs`, `ci`, `deps`, `repo`.
- O tipo do commit define o bump de versão dos pacotes (`feat` → minor, `fix`/`perf`/`revert` → patch, `!` → major), aplicado automaticamente pelos hooks (`scripts/bump-versions.js`).
- Um commit = uma mudança lógica, com testes e documentação junto do código.

## Limite de arquivos por commit

**No máximo 30 arquivos alterados por commit**, contando `pnpm-lock.yaml`, testes e documentação. Não contam os `package.json` cuja única mudança é o `version` do bump automático.

- **Por quê:** commits menores são revisáveis de verdade, isolam regressões e mantêm o histórico útil para `git bisect` e reverts.
- **Como é verificado:** o hook `pre-commit` bloqueia commits acima do limite (`node scripts/check-commit-size.js --staged`), e o CI confere cada commit do PR (`--range`), cobrindo commits feitos sem os hooks.
- **Se não couber:** divida por camada ou por dependência, por exemplo `contracts` → `api` → `web`, ou schema/migration → casos de uso → rotas. Cada commit deve passar sozinho pelos gates abaixo.

## Gates locais

Antes de abrir o PR, rode e deixe verde:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:coverage
```

`pnpm test:coverage` sobe PostgreSQL com Testcontainers (requer Docker) e executa os testes unitários e de integração do backend numa só rodada, aplicando as metas de cobertura sobre o total.

## Testes e cobertura

- Toda regra de negócio nova tem teste unitário; todo endpoint novo tem teste de integração (Testcontainers + `fastify.inject`).
- Metas ([docs/09 §9.5](docs/09-estrategia-de-testes.md#95-cobertura-e-gates-de-qualidade)): linhas ≥ 80% global e ≥ 90% no domínio.
- **Backend:** a cobertura **soma unitários e integração**. Repositórios, migrations e rotas são exercitados contra o banco real, sem exclusões artificiais; só os entrypoints (`server`, `worker`, `migrate`) ficam fora.
- **Frontend e `contracts`:** cobertura dos testes unitários (`pnpm test`).

## Código

- TypeScript strict, sem `any` nem `@ts-ignore`; arquivos em `kebab-case`; alias `@/` dentro de cada app.
- Domínio sem I/O; módulos não importam repositórios de outros módulos (regras de lint).
- Erros sempre em Problem Details, com os códigos de `@contatos/contracts`; mensagens ao usuário em português.
- Dependências novas com versão fixa (sem `^`).

## Segurança

Nunca versione segredos (`.env` está no `.gitignore`; o CI roda gitleaks sobre todo o histórico). Em testes, use senhas fictícias no padrão `senha-<palavra>-<número>` (ex.: `senha-forte-123`): o [`.gitleaks.toml`](.gitleaks.toml) só as aceita dentro de arquivos de teste. Outro falso positivo deve ganhar uma exceção igualmente restrita no `.gitleaks.toml`, revisada no PR; nunca desative regras inteiras. Vulnerabilidades devem ser reportadas de forma privada, conforme o [SECURITY.md](SECURITY.md).
