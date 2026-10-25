import { react } from '@contatos/vitest-config/react';
import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default mergeConfig(
  mergeConfig(viteConfig, react),
  defineConfig({
    test: {
      setupFiles: ['./src/test/setup.ts'],
      coverage: {
        exclude: ['src/main.tsx', 'src/routeTree.gen.ts'],
      },
    },
  }),
);
