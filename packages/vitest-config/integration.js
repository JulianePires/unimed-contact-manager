// Integração do backend: Testcontainers (PostgreSQL real) + fastify.inject (docs/09 §9.4).
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import { base } from './base.js';

export const integration = mergeConfig(
  base,
  defineConfig({
    test: {
      environment: 'node',
      include: ['test/integration/**/*.{test,spec}.ts'],
      exclude: configDefaults.exclude,
      // Subir o container do PostgreSQL leva segundos; um container por worker
      hookTimeout: 120_000,
      testTimeout: 30_000,
      pool: 'forks',
      coverage: { enabled: false },
    },
  }),
);
