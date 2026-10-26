import { node } from '@contatos/vitest-config/node';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  node,
  defineConfig({
    test: {
      coverage: {
        // Entrypoints, camada de dados e repositórios são exercitados pelos testes de integração
        exclude: [
          'src/{server,worker,migrate,paths}.ts',
          'src/shared/db/**',
          'src/modules/*/repositories/**',
        ],
        // Domínio puro tem meta maior que a global (docs/09 §9.5)
        thresholds: { 'src/modules/*/domain/**': { lines: 90 } },
      },
    },
  }),
);
