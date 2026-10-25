/** Conventional Commits — docs/07-estrutura.md §7.4 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      ['api', 'web', 'contracts', 'tsconfig', 'docs', 'ci', 'deps', 'repo'],
    ],
  },
};
