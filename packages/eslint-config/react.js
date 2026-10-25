// Frontend: React Compiler/hooks, acessibilidade e segurança (ADR-008, ADR-009).
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';

import { base } from './base.js';

const STORAGE_APIS = ['localStorage', 'sessionStorage', 'indexedDB'];

export const react = defineConfig([
  base,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest'], jsxA11y.flatConfigs.strict],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Proibido dangerouslySetInnerHTML (ADR-008).',
        },
      ],
      'no-restricted-globals': [
        'error',
        ...STORAGE_APIS.map((name) => ({
          name,
          message: 'Sem dados no armazenamento do navegador (ADR-009).',
        })),
      ],
      'no-restricted-properties': [
        'error',
        ...STORAGE_APIS.map((property) => ({
          object: 'window',
          property,
          message: 'Proibido (ADR-009).',
        })),
      ],
    },
  },
]);
