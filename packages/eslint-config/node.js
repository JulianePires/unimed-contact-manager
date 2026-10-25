// API, worker e pacotes compartilhados: ambiente Node.
import { defineConfig } from 'eslint/config';
import globals from 'globals';

import { base } from './base.js';

export const node = defineConfig([
  base,
  {
    files: ['**/*.ts'],
    languageOptions: { globals: globals.node },
  },
]);
