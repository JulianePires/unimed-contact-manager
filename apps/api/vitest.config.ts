import { node } from '@contatos/vitest-config/node';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  node,
  defineConfig({
    test: {
      coverage: {
        // Entrypoint e adaptador do banco são exercitados pelos testes de integração
        exclude: ['src/server.ts', 'src/shared/db/client.ts'],
        // Domínio puro tem meta maior que a global (docs/09 §9.5)
        thresholds: { 'src/modules/*/domain/**': { lines: 90 } },
      },
    },
  }),
);
