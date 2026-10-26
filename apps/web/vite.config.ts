import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const isVitest = process.env['VITEST'] !== undefined;

export default defineConfig({
  plugins: [
    // Gera src/routeTree.gen.ts; precisa vir antes do plugin do React
    // Sob o Vitest, rotas sem divisão em chunks (carregar cada chunk no primeiro acesso deixa os
    // testes lentos e instáveis com cobertura) e sem HMR (o código injetado distorce a cobertura)
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      codeSplittingOptions: isVitest ? { addHmr: false, defaultBehavior: [] } : {},
    }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: { tsconfigPaths: true },
  build: {
    // Mantém a ordem de execução dos imports entre chunks: a configuração do Zod sem JIT
    // (lib/zod-jitless) precisa rodar antes dos schemas, ou a CSP com Trusted Types reporta violação
    rolldownOptions: { output: { strictExecutionOrder: true } },
  },
  server: {
    // Mesma origem em desenvolvimento: /api vai para a API (docs/03)
    proxy: { '/api': 'http://localhost:3000' },
  },
});
