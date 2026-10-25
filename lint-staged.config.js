/** @type {import('lint-staged').Configuration} */
export default {
  '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix --max-warnings=0 --no-warn-ignored', 'prettier --write'],
  '*.{json,md,yml,yaml,css,html}': 'prettier --write',
  // Typecheck do workspace inteiro (cache do Turbo); tsc não aceita arquivos isolados com project config
  '*.{ts,tsx}': () => 'turbo run typecheck',
};
