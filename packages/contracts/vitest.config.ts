import { node } from '@contatos/vitest-config/node';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  node,
  defineConfig({
    test: {
      // contracts é todo domínio compartilhado (docs/09 §9.5)
      coverage: { thresholds: { lines: 90 } },
    },
  }),
);
