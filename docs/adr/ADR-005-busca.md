# ADR-005 — Busca por nome, e-mail ou celular

- **Status:** Aceito
- **Data:** 2026-10-23
- **Relacionados:** ADR-004

## Contexto

A listagem precisa de busca por nome, e-mail ou celular. Usuários digitam sem acento ("joao" deve achar "João"), trechos parciais e números em formatos variados. `ILIKE '%termo%'` não usa índice B-tree.

## Decisão

1. **Parâmetro único `q` com intenção detectada:**
   - apenas dígitos (após remover máscara) → busca parcial em `mobile_e164`;
   - contém `@` → busca em `email`;
   - demais casos → busca em `name` e `email`.
2. **Normalização no banco:** extensões `unaccent` e `pg_trgm`. Como `unaccent()` não é `IMMUTABLE` (depende de dicionário configurável) e não pode ser usada diretamente em índice, cria-se uma função wrapper imutável:

   ```sql
   CREATE FUNCTION f_unaccent(text) RETURNS text
     LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
     AS $$ SELECT public.unaccent('public.unaccent', $1) $$;

   CREATE INDEX contacts_name_trgm
     ON contacts USING gin (f_unaccent(lower(name)) gin_trgm_ops);
   ```

   Índices análogos para `email` e `mobile_e164`.
3. **Consulta:** `f_unaccent(lower(name)) ILIKE '%' || f_unaccent(lower($q)) || '%'`, sempre combinada com `owner_id` e filtros de `status`/`favorite`.
4. Termos com menos de 2 caracteres não disparam busca.

## Alternativas consideradas

- **Coluna normalizada pela aplicação:** testável em unidade, mas pode divergir de dados escritos fora da aplicação (scripts, migrações).
- **Full-text search (`tsvector`):** otimizado para palavras inteiras e linguagem natural; ruim para trechos de nome, e-mail e número.
- **Motor externo (Elasticsearch/Meilisearch):** desproporcional ao volume.

## Consequências

- (+) Busca tolerante a acentos e caixa, com índice, e regra centralizada no banco.
- (−) Dependência de extensões do PostgreSQL (disponíveis nos provedores gerenciados mais comuns, a confirmar no provedor escolhido).
- (−) O wrapper fixa o dicionário; alterá-lo exige recriar os índices.
