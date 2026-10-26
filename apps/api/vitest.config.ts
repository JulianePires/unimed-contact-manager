import { backend } from '@contatos/vitest-config/backend';
import { defineConfig, mergeConfig } from 'vitest/config';

export default mergeConfig(
  backend,
  defineConfig({
    test: {
      coverage: {
        // Entrypoints só sobem o processo; o restante é coberto por unitários + integração
        exclude: ['src/{server,worker,migrate,seed,paths}.ts'],
        // Domínio puro tem meta maior que a global (docs/09 §9.5)
        thresholds: { 'src/modules/*/domain/**': { lines: 90 } },
      },
    },
  }),
);
