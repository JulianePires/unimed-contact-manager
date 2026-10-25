import { node } from '@contatos/eslint-config/node';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  node,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },
]);
