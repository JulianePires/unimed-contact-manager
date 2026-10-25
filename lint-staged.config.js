/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,tsx,js,mjs,cjs}': [
    'eslint --fix --max-warnings=0 --no-warn-ignored',
    'biome format --write --no-errors-on-unmatched',
  ],
  '*.{json,jsonc,css,md,yml,yaml}': 'biome format --write --no-errors-on-unmatched',
  // Typecheck do workspace inteiro (cache do Turbo); tsc não aceita arquivos isolados com project config
  '*.{ts,tsx}': () => 'turbo run typecheck',
};
