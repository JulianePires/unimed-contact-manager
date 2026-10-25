// Config da raiz: arquivos soltos (commitlint, lint-staged…) e pacotes de configuração.
// Apps e pacotes com código têm o próprio eslint.config.js; o ESLint usa o mais próximo de cada arquivo.
import { base } from '@contatos/eslint-config/base';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  base,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
]);
