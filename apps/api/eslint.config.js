// Regras de arquitetura da API (ADR-007) sobre a base Node compartilhada.
import { node } from '@contatos/eslint-config/node';
import { defineConfig, globalIgnores } from 'eslint/config';

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

/** Globais com I/O ou dependentes do ambiente: entram no domínio só por portas injetadas (ADR-007). */
const IO_GLOBALS = [
  'fetch',
  'WebSocket',
  'XMLHttpRequest',
  'EventSource',
  'process',
  'setTimeout',
  'setInterval',
  'setImmediate',
];

export default defineConfig([
  globalIgnores(['drizzle/']),
  node,
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
  },

  // Domínio puro: sem I/O (ADR-007)
  {
    files: ['src/modules/*/domain/**/*.ts'],
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
      'no-restricted-globals': [
        'error',
        ...IO_GLOBALS.map((name) => ({
          name,
          message: 'Domínio é puro: receba I/O por porta injetada (ADR-007).',
        })),
      ],
      'no-restricted-properties': [
        'error',
        ...IO_GLOBALS.map((property) => ({
          object: 'globalThis',
          property,
          message: 'Domínio é puro: receba I/O por porta injetada (ADR-007).',
        })),
      ],
      // Relógio injetável no domínio (docs/09 §9.4)
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Use o Clock injetado (docs/09 §9.4).',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Use o Clock injetado (docs/09 §9.4).',
        },
      ],
    },
  },

  // Fora dos módulos (app.ts, shared…), nenhum repositório: cada módulo monta o seu no index.ts
  {
    files: ['src/**/*.ts'],
    ignores: ['src/modules/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/modules/*/repository', '**/modules/*/repositories/*'],
              message: 'Repositórios são privados ao módulo; use o index.ts dele (ADR-007).',
            },
          ],
        },
      ],
    },
  },

  // Repositório de um módulo só é acessado pelo próprio módulo (docs/07 §7.4)
  ...API_MODULES.map((mod) => ({
    files: [`src/modules/${mod}/**/*.ts`],
    ignores: [`src/modules/${mod}/domain/**`],
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
]);
