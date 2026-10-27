// T-NF02 (RNF10): importação de 10 mil linhas em < 60 s; enquanto ela roda, 20 VUs na listagem e na
// busca com p95 < 500 ms.
//   k6 run perf/k6/import-load.js   (BASE_URL, ROWS; massa: pnpm --filter @contatos/api perf:seed)
import { check, sleep } from 'k6';
import http from 'k6/http';
import { Trend } from 'k6/metrics';

import { API, CSRF, listAndSearch, login, register } from './lib.js';

const ROWS = Number(__ENV.ROWS || 10_000);
const TERMINAL = ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'];

const importDuration = new Trend('import_duration', true);

export const options = {
  scenarios: {
    import: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 1,
      maxDuration: '2m',
      exec: 'track',
    },
    listing: { executor: 'constant-vus', vus: 20, duration: '75s', exec: 'listing' },
  },
  thresholds: {
    import_duration: ['max<60000'],
    'http_req_duration{endpoint:list,phase:during}': ['p(95)<500'],
    'http_req_duration{endpoint:search,phase:during}': ['p(95)<500'],
    'http_req_failed{phase:during}': ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

/** Mesmo formato do test/fixtures/large-csv.ts da API: `;`, acentos e 1 linha inválida a cada 100. */
function largeCsv(rowCount) {
  const lines = ['nome;email;celular;telefone'];
  for (let n = 1; n <= rowCount; n += 1) {
    const suffix = String(n).padStart(8, '0');
    const email = n % 100 === 0 ? `contato${n}@` : `contato${n}@empresa.com`;
    lines.push(`Conceição ${n};${email};(81) 9${suffix.slice(0, 4)}-${suffix.slice(4)};`);
  }
  return `${lines.join('\n')}\n`;
}

const csv = largeCsv(ROWS);

export function setup() {
  const importer = register('Importação k6');
  const upload = http.post(
    `${API}/imports`,
    { file: http.file(csv, `carga-${ROWS}.csv`, 'text/csv') },
    { headers: { ...CSRF, Cookie: importer }, tags: { name: 'POST /imports' } },
  );
  if (!check(upload, { 'importação 202': (r) => r.status === 202 })) {
    throw new Error(`Upload falhou (${upload.status}): ${upload.body}`);
  }
  return { reader: login(), importer, importId: upload.json().id };
}

function importStatus({ importer, importId }) {
  return http
    .get(`${API}/imports/${importId}`, {
      headers: { Cookie: importer },
      tags: { name: 'GET /imports/:id' },
    })
    .json();
}

export function track(data) {
  let current = importStatus(data);
  while (!TERMINAL.includes(current.status)) {
    sleep(1);
    current = importStatus(data);
  }
  check(current, {
    'importação concluída': (i) => i.status !== 'FAILED',
    'todas as linhas processadas': (i) => i.processedRows === ROWS,
  });
  const total = Date.parse(current.finishedAt) - Date.parse(current.createdAt);
  importDuration.add(total);
  console.log(
    `importação ${current.status}: ${current.createdCount} criados, ${current.failedCount} com erro; ` +
      `envio→fim ${total} ms, processamento ${Date.parse(current.finishedAt) - Date.parse(current.startedAt)} ms`,
  );
}

let finished = false;

export function listing(data) {
  if (finished) {
    sleep(1);
    return;
  }
  finished = TERMINAL.includes(importStatus(data).status);
  if (!finished) listAndSearch(data.reader, { phase: 'during' });
}
