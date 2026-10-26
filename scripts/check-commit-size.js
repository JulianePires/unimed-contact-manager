#!/usr/bin/env node
// Limite de arquivos por commit (CONTRIBUTING.md): no máximo 30, contando pnpm-lock.yaml.
// O bump automático de `version` nos package.json (scripts/bump-versions.js) não conta.
//
// Uso: node scripts/check-commit-size.js --staged         (Husky: pre-commit)
//      node scripts/check-commit-size.js --range A..B     (CI: cada commit do PR, sem merges)
import { execFileSync } from 'node:child_process';

export const MAX_FILES_PER_COMMIT = 30;
const VERSION_LINE = /^[+-]\s*"version":\s*"[^"]*",?\s*$/;

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

const lines = (output) => (output ? output.split('\n') : []);

/** package.json cuja única mudança é o campo `version`. */
function isVersionBumpOnly(diffArgs, file) {
  if (!file.endsWith('package.json')) return false;
  const changed = lines(git('diff', '-U0', ...diffArgs, '--', file)).filter(
    (line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line),
  );
  return changed.length > 0 && changed.every((line) => VERSION_LINE.test(line));
}

function countFiles(diffArgs) {
  return lines(git('diff', '--name-only', ...diffArgs)).filter(
    (file) => !isVersionBumpOnly(diffArgs, file),
  ).length;
}

function report(label, count) {
  if (count <= MAX_FILES_PER_COMMIT) return true;
  process.stderr.write(
    `${label}: ${count} arquivos alterados (limite: ${MAX_FILES_PER_COMMIT}). ` +
      'Divida a mudança em commits menores (CONTRIBUTING.md).\n',
  );
  return false;
}

const rangeIndex = process.argv.indexOf('--range');
let ok = true;

if (process.argv.includes('--staged')) {
  ok = report('Commit', countFiles(['--cached']));
} else if (rangeIndex !== -1 && process.argv[rangeIndex + 1]) {
  for (const sha of lines(git('rev-list', '--no-merges', process.argv[rangeIndex + 1]))) {
    ok = report(git('log', '-1', '--format=%h %s', sha), countFiles([`${sha}^`, sha])) && ok;
  }
} else {
  process.stderr.write('Uso: check-commit-size.js --staged | --range <base>..<head>\n');
  process.exit(2);
}

process.exit(ok ? 0 : 1);
