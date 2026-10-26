// API e worker: unitários e integração como projetos de uma mesma execução, para que a cobertura
// some as duas suítes (docs/09 §9.5). `--project unit` ou `--project integration` roda uma só.
import { defineConfig, mergeConfig } from 'vitest/config';

import { base } from './base.js';
import { integration } from './integration.js';
import { node } from './node.js';

export const backend = defineConfig({
  test: {
    coverage: base.test?.coverage,
    projects: [
      mergeConfig(node, { test: { name: 'unit' } }),
      mergeConfig(integration, { test: { name: 'integration' } }),
    ],
  },
});
