#!/usr/bin/env node
// Atualiza o campo `version` dos pacotes do workspace a partir dos Conventional Commits
// (commitlint.config.js), sempre em relação à main: a versão-alvo é a versão do pacote no
// merge-base com a main mais o maior bump entre os commits da branch que tocam a pasta dele:
//   BREAKING CHANGE / `tipo!:`  → major
//   feat                        → minor
//   fix, perf, revert           → patch
//   demais tipos                → sem bump
// Dependentes internos de um pacote atualizado recebem ao menos patch.
// O cálculo é idempotente: vários commits na mesma branch geram um único bump sobre a main.
//
// Uso: pnpm version:bump [--dry-run | --check | --hook]
//   --dry-run  só mostra o que mudaria
//   --check    falha se alguma versão difere do alvo (CI)
//   --hook     grava e inclui os package.json no último commit (Husky: post-commit e post-rewrite)
// A referência da main é `origin/main` (ou `main`, se não houver remoto); sobrescreva com BUMP_BASE.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const LEVELS = ['none', 'patch', 'minor', 'major'];
const PATCH_TYPES = new Set(['fix', 'perf', 'revert']);
const HEADER = /^(?<type>\w+)(?:\([^)]*\))?(?<breaking>!)?: .+/;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: /m;
const VERSION_FIELD = /("version":\s*")[^"]+(")/;

const mode = ['--dry-run', '--check', '--hook'].find((flag) => process.argv.includes(flag));

function git(...args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

function tryGit(...args) {
  try {
    return git(...args);
  } catch {
    return null;
  }
}

/** Nível de bump de um commit (índice em LEVELS). */
function commitLevel(subject, body) {
  const match = HEADER.exec(subject);
  if (!match?.groups) return 0;
  if (match.groups.breaking || BREAKING_FOOTER.test(body)) return 3;
  if (match.groups.type === 'feat') return 2;
  return PATCH_TYPES.has(match.groups.type) ? 1 : 0;
}

function bump(version, level) {
  const [major, minor, patch] = version.split('.').map(Number);
  if (level === 3) return `${major + 1}.0.0`;
  if (level === 2) return `${major}.${minor + 1}.0`;
  if (level === 1) return `${major}.${minor}.${patch + 1}`;
  return version;
}

/** Pastas do workspace, a partir dos padrões `pasta/*` do pnpm-workspace.yaml. */
function workspaceDirs() {
  const yaml = readFileSync('pnpm-workspace.yaml', 'utf8');
  const patterns = [...yaml.matchAll(/^\s*-\s*['"]?([^'"\s]+)\/\*['"]?\s*$/gm)].map((m) => m[1]);
  return patterns.flatMap((base) =>
    readdirSync(base, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && existsSync(join(base, entry.name, 'package.json')))
      .map((entry) => `${base}/${entry.name}`),
  );
}

function mainRef() {
  const candidates = process.env.BUMP_BASE ? [process.env.BUMP_BASE] : ['origin/main', 'main'];
  const ref = candidates.find((candidate) => tryGit('rev-parse', '--verify', '--quiet', candidate));
  if (!ref) throw new Error(`Referência da main não encontrada (${candidates.join(', ')}).`);
  return ref;
}

/** Commits da branch (fora da main) que tocam a pasta. */
function branchCommits(dir, base) {
  const log = git('log', `${base}..HEAD`, '--no-merges', '--format=%h%x1f%s%x1f%b%x1e', '--', dir);
  return log
    .split('\x1e')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [hash = '', subject = '', body = ''] = entry.split('\x1f');
      return { hash, subject, level: commitLevel(subject, body) };
    })
    .filter((commit) => !onlyVersionChanged(commit.hash, dir));
}

/** Commit que só tocou o `version` do pacote (bump emendado em outro commit): não conta para ele. */
function onlyVersionChanged(hash, dir) {
  const diff = git('show', '--format=', '--unified=0', hash, '--', dir);
  const changes = diff
    .split('\n')
    .filter((line) => /^[+-]/.test(line) && !/^(\+\+\+|---) /.test(line));
  const files = diff.split('\n').filter((line) => line.startsWith('diff --git'));
  return (
    files.length === 1 &&
    files[0]?.endsWith(`${dir}/package.json`) === true &&
    changes.every((line) => VERSION_FIELD.test(line))
  );
}

/** Rebase, cherry-pick e revert reaplicam commits: o hook não deve emendá-los. */
function sequencerInProgress() {
  const gitDir = git('rev-parse', '--git-dir');
  return ['rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD'].some((entry) =>
    existsSync(join(gitDir, entry)),
  );
}

function main() {
  if (mode === '--hook' && process.env.BUMP_VERSIONS_RUNNING) return;
  // post-rewrite roda com o rebase já concluído, mas antes de o git limpar o estado dele
  if (mode === '--hook' && !process.env.BUMP_AFTER_REWRITE && sequencerInProgress()) return;

  const base = git('merge-base', 'HEAD', mainRef());
  const packages = workspaceDirs().map((dir) => {
    const path = `${dir}/package.json`;
    const raw = readFileSync(path, 'utf8');
    const json = JSON.parse(raw);
    // Pacote criado na branch parte da versão com que foi criado
    const baseRaw = tryGit('show', `${base}:${path}`);
    const baseVersion = baseRaw ? JSON.parse(baseRaw).version : json.version;
    const commits = branchCommits(dir, base);
    const level = Math.max(0, ...commits.map((c) => c.level));
    return { path, raw, json, baseVersion, commits, level, reasons: [] };
  });

  // Propaga patch para dependentes internos até estabilizar
  const byName = new Map(packages.map((pkg) => [pkg.json.name, pkg]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const pkg of packages) {
      const deps = { ...pkg.json.dependencies, ...pkg.json.devDependencies };
      for (const name of Object.keys(deps)) {
        const dep = byName.get(name);
        if (dep && dep.level > 0 && pkg.level === 0) {
          pkg.level = 1;
          pkg.reasons.push(`dependência ${name} atualizada`);
          changed = true;
        }
      }
    }
  }

  const outdated = packages
    .map((pkg) => ({ ...pkg, target: bump(pkg.baseVersion, pkg.level) }))
    .filter((pkg) => pkg.target !== pkg.json.version);

  if (outdated.length === 0) {
    if (mode !== '--hook') process.stdout.write('Versões em dia com a main.\n');
    return;
  }

  const out = [];
  for (const pkg of outdated) {
    out.push(
      `${pkg.json.name}: ${pkg.json.version} → ${pkg.target} (main: ${pkg.baseVersion}, ${LEVELS[pkg.level]})`,
    );
    for (const c of pkg.commits.filter((c) => c.level > 0)) {
      out.push(`  ${c.hash} [${LEVELS[c.level]}] ${c.subject}`);
    }
    for (const reason of pkg.reasons) out.push(`  [patch] ${reason}`);
  }
  process.stdout.write(`${out.join('\n')}\n`);

  if (mode === '--dry-run') {
    process.stdout.write('\n(--dry-run: nada foi gravado)\n');
    return;
  }
  if (mode === '--check') {
    process.stderr.write('\nVersões fora do esperado: rode `pnpm version:bump` e faça commit.\n');
    process.exitCode = 1;
    return;
  }

  const paths = outdated.map((pkg) => pkg.path);
  if (mode === '--hook') {
    // Não leva para o commit edições que o usuário ainda não commitou
    const dirty = tryGit('status', '--porcelain', '--', ...paths);
    if (dirty) {
      process.stderr.write(
        `\nVersões não atualizadas: há mudanças pendentes em\n${dirty}\nCommit-as e rode \`pnpm version:bump\`.\n`,
      );
      return;
    }
  }

  // Troca só o valor da versão, preservando a formatação do arquivo
  for (const pkg of outdated) {
    writeFileSync(pkg.path, pkg.raw.replace(VERSION_FIELD, `$1${pkg.target}$2`));
  }

  if (mode === '--hook') {
    execFileSync(
      'git',
      ['commit', '--amend', '--no-edit', '--no-verify', '--only', '--', ...paths],
      {
        stdio: 'ignore',
        env: { ...process.env, BUMP_VERSIONS_RUNNING: '1' },
      },
    );
    process.stdout.write('Versões incluídas no último commit.\n');
  }
}

main();
