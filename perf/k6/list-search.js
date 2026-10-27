// T-NF01 (RNF09): listagem e busca com 10 mil contatos por usuário, 20 VUs, p95 < 300 ms.
//   k6 run perf/k6/list-search.js   (BASE_URL, DURATION; massa: pnpm --filter @contatos/api perf:seed)
import { listAndSearch, login } from './lib.js';

export const options = {
  scenarios: {
    list_search: { executor: 'constant-vus', vus: 20, duration: __ENV.DURATION || '1m' },
  },
  thresholds: {
    'http_req_duration{endpoint:list}': ['p(95)<300'],
    'http_req_duration{endpoint:search}': ['p(95)<300'],
    'http_req_failed{endpoint:list}': ['rate<0.01'],
    'http_req_failed{endpoint:search}': ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

export function setup() {
  return { cookie: login() };
}

export default function ({ cookie }) {
  listAndSearch(cookie);
}
