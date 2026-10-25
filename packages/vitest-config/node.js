// Unitários de API, worker e contracts: Node, sem I/O (docs/09).
import { defineConfig, mergeConfig } from 'vitest/config';

import { base, unitExclude } from './base.js';

export const node = mergeConfig(
  base,
  defineConfig({
    test: {
      environment: 'node',
      include: ['{src,test}/**/*.{test,spec}.ts'],
      exclude: unitExclude,
    },
  }),
);
