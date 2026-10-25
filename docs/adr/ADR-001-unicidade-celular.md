# ADR-001 — Unicidade do número de celular

- **Status:** Aceito
- **Data:** 2026-10-23

## Contexto

O requisito exige unicidade do celular, inclusive sob operações simultâneas, e que a regra para contatos inativos seja definida e documentada. Contatos pertencem a cada usuário (agenda individual). A importação em lote também precisa ser idempotente (ver ADR-002).

## Decisão

1. **Normalização obrigatória:** todo celular é normalizado para E.164 (`libphonenumber-js`, região padrão `BR`) e validado como tipo `MOBILE` antes de qualquer persistência. A coluna `mobile_e164` guarda o valor canônico; a formatação é responsabilidade da apresentação.
2. **Escopo:** a unicidade vale por usuário — `UNIQUE (owner_id, mobile_e164)`.
3. **Inativos bloqueiam:** a constraint é global dentro da agenda do usuário, independentemente do status. Um contato inativo continua "dono" do número.
4. **Garantia no banco, não na aplicação:** a constraint do PostgreSQL é a fonte da verdade. A aplicação não faz "SELECT antes do INSERT" como garantia; captura a violação `23505` e a traduz para `409 Conflict`.
5. **Erros semânticos:**
   - `MOBILE_ALREADY_EXISTS` — conflito com contato ativo.
   - `MOBILE_BELONGS_TO_INACTIVE_CONTACT` — conflito com contato inativo; a resposta inclui o `id` do contato para o front oferecer "Reativar".
6. **E-mail não é único:** apenas o celular, conforme o requisito (e-mails podem ser compartilhados por famílias/empresas).

## Alternativas consideradas

- **Único apenas entre ativos (índice parcial `WHERE active`):** permite reaproveitar número reciclado, mas reprocessar um arquivo após inativar um contato geraria um segundo contato com o mesmo celular — duplicidade semântica que fere o requisito de idempotência da importação. Também exige tratar conflito na reativação.
- **Global + importação reativa inativos automaticamente:** esconde uma mudança de estado decidida pelo usuário (inativar) atrás de um processo em lote. Rejeitado por ser efeito colateral surpreendente.
- **Validação na aplicação (check-then-insert):** sujeita a race condition (TOCTOU). Rejeitado.

## Consequências

- (+) Garantia forte sob concorrência, inclusive entre API e worker de importação.
- (+) Regra coerente com a idempotência da importação.
- (+) Histórico preservado: inativar nunca libera o número silenciosamente.
- (−) Número reciclado pela operadora exige editar ou alterar o contato inativo antes de cadastrar a nova pessoa. Fluxo explícito e guiado pelo erro `MOBILE_BELONGS_TO_INACTIVE_CONTACT`.
- (−) Dependência de biblioteca de telefonia para normalização (aceitável; é o padrão de mercado).
