import { defineConfig, devices } from '@playwright/test';

const CI = process.env['CI'] !== undefined;

/**
 * E2E (docs/09 §9.3, T-E2E01–05) contra a stack completa do Docker Compose (API + SPA + worker +
 * PostgreSQL), já em execução: `docker compose up -d` e depois `pnpm test:e2e`.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: CI,
  // Teste instável não é tolerado (docs/09 §9.5): sem retentativa que esconda o problema
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:3000',
    locale: 'pt-BR',
    timezoneId: 'America/Recife',
    // Sem transições, o axe nunca mede o contraste de um toast do sonner no meio do fade
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
