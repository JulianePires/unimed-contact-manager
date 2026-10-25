// Opções comuns a todos os pacotes (ADR-010). Uso interno: os pacotes estendem node, react ou integration.
// `include`/`exclude` ficam em cada preset: mergeConfig concatena arrays em vez de substituí-los.
import { configDefaults, defineConfig } from 'vitest/config';

/** Integração e E2E rodam em tasks próprias (test:integration, test:e2e). */
export const unitExclude = [...configDefaults.exclude, '**/test/integration/**', '**/e2e/**'];

export const base = defineConfig({
  test: {
    // Cada pacote roda o próprio Vitest via Turbo; pacote sem testes ainda não deve quebrar o pipeline
    passWithNoTests: true,
    // Isolamento entre testes: mocks, envs e globals sempre restaurados
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.{test,spec}.{ts,tsx}', '**/test/**', '**/*.d.ts'],
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      // Metas globais (docs/09 §9.5); pacotes com domínio sobem a meta das próprias pastas
      thresholds: { lines: 80 },
    },
  },
});
