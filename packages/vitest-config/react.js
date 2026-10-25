// Componentes e hooks do frontend: jsdom + Testing Library (docs/09).
// O pacote consumidor declara `jsdom` e o próprio `setupFiles` (ex.: src/test/setup.ts).
import { defineConfig, mergeConfig } from 'vitest/config';

import { base, unitExclude } from './base.js';

export const react = mergeConfig(
  base,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: unitExclude,
      css: false,
    },
  }),
);
