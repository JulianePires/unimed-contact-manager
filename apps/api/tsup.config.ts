import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  noExternal: ['@contatos/contracts'],
  sourcemap: true,
  clean: true,
});
