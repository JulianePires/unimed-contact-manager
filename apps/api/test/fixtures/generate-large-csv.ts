// Gera test/fixtures/10k-linhas.csv (não versionado): pnpm --filter @contatos/api fixtures:large [linhas]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { generateLargeCsv } from './large-csv';

const rowCount = Number(process.argv[2] ?? 10_000);
const target = fileURLToPath(new URL('10k-linhas.csv', import.meta.url));

writeFileSync(target, generateLargeCsv(rowCount));
process.stdout.write(`${rowCount} linhas em ${target}\n`);
