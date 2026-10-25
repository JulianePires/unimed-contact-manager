// Flat config única do monorepo, com regras por pasta (ADR-011).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const API_MODULES = ['auth', 'contacts', 'imports'];

/** Domínio puro, sem I/O (ADR-007). */
const IO_MODULES = [
  'fastify',
  '@fastify/*',
  'pg',
  'pg-boss',
  'drizzle-orm',
  'drizzle-orm/*',
  'pino',
  'node:fs',
  'node:fs/*',
  'node:net',
  'node:http',
  'node:https',
  'node:child_process',
  'fs',
  'fs/*',
  'net',
  'http',
  'https',
  'child_process',
];

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/build/',
    '**/coverage/',
    '**/.turbo/',
    '**/playwright-report/',
    '**/test-results/',
    'apps/api/drizzle/',
    'apps/web/src/routeTree.gen.ts',
  ]),

  // Base: JS + TypeScript strict com checagem de tipos
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
    },
  },

  // Arquivos JS de configuração (fora dos tsconfig): sem checagem de tipos
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  // API, worker e contracts: ambiente Node
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Domínio puro: sem I/O (ADR-007)
  {
    files: ['apps/api/src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: IO_MODULES,
              message: 'Domínio é puro: sem I/O, framework ou banco (ADR-007).',
            },
            {
              group: ['**/repository', '**/repositories/*', '**/use-cases/*', '**/routes'],
              message: 'Domínio não depende de camadas externas (ADR-007).',
            },
          ],
        },
      ],
    },
  },

  // Repositório de um módulo só é acessado pelo próprio módulo (docs/07 §7.4)
  ...API_MODULES.map((mod) => ({
    files: [`apps/api/src/modules/${mod}/**/*.ts`],
    ignores: [`apps/api/src/modules/${mod}/domain/**`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: API_MODULES.filter((other) => other !== mod).map((other) => ({
            group: [
              `**/modules/${other}/repository`,
              `**/modules/${other}/repositories/*`,
              `**/${other}/repository`,
              `**/${other}/repositories/*`,
            ],
            message: `Use os casos de uso de "${other}"; repositórios são privados ao módulo (ADR-007).`,
          })),
        },
      ],
    },
  })),

  // Frontend: React Compiler/hooks, acessibilidade e segurança (ADR-008, ADR-009)
  {
    files: ['apps/web/**/*.{ts,tsx}'],
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
        { name: 'localStorage', message: 'Sem dados no armazenamento do navegador (ADR-009).' },
        { name: 'sessionStorage', message: 'Sem dados no armazenamento do navegador (ADR-009).' },
        { name: 'indexedDB', message: 'Sem dados no armazenamento do navegador (ADR-009).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'localStorage', message: 'Proibido (ADR-009).' },
        { object: 'window', property: 'sessionStorage', message: 'Proibido (ADR-009).' },
        { object: 'window', property: 'indexedDB', message: 'Proibido (ADR-009).' },
      ],
    },
  },

  // Testes: relaxa regras que atrapalham asserts e mocks
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/test/**/*.{ts,tsx}', 'apps/web/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },

  // Desliga regras de estilo que conflitam com o Prettier (sempre por último)
  prettier,
]);
