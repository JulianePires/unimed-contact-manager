import { check } from 'k6';
import http from 'k6/http';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
export const API = `${BASE_URL}/api/v1`;
export const CSRF = { 'X-Requested-With': 'fetch' };

function sessionCookie(response) {
  const [name] = Object.keys(response.cookies);
  return `${name}=${response.cookies[name][0].value}`;
}

/** Login da conta criada por `perf:seed`; devolve o header `Cookie` para os VUs. */
export function login(
  email = __ENV.PERF_EMAIL || 'perf@contatos.app',
  password = __ENV.PERF_PASSWORD,
) {
  if (!password) throw new Error('Defina PERF_PASSWORD, a mesma senha usada no perf:seed');
  const response = http.post(`${API}/auth/login`, JSON.stringify({ email, password }), {
    headers: { ...CSRF, 'Content-Type': 'application/json' },
  });
  if (!check(response, { 'login 200': (r) => r.status === 200 })) {
    throw new Error(`Login falhou (${response.status}): rode o perf:seed antes`);
  }
  return sessionCookie(response);
}

export function register(name) {
  const id = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const body = { name, email: `k6-${id}@exemplo.com`, password: `k6-senha-${id}` };
  const response = http.post(`${API}/auth/register`, JSON.stringify(body), {
    headers: { ...CSRF, 'Content-Type': 'application/json' },
  });
  if (!check(response, { 'cadastro 201': (r) => r.status === 201 })) {
    throw new Error(`Cadastro falhou (${response.status})`);
  }
  return sessionCookie(response);
}

const TERMS = ['silva', 'conceicao', 'ana araujo', 'carga42', 'carga1234@empresa.com', '92000123'];

/** Uma página aleatória da listagem e uma busca (nome, e-mail ou celular), como na tela de contatos. */
export function listAndSearch(cookie, tags = {}) {
  const headers = { Cookie: cookie };
  const page = 1 + Math.floor(Math.random() * 400);
  const sort = ['name', '-name', 'createdAt', '-createdAt'][page % 4];
  const list = http.get(`${API}/contacts?page=${page}&pageSize=20&sort=${sort}`, {
    headers,
    tags: { ...tags, name: 'GET /contacts', endpoint: 'list' },
  });
  const term = TERMS[Math.floor(Math.random() * TERMS.length)];
  const search = http.get(`${API}/contacts?q=${encodeURIComponent(term)}`, {
    headers,
    tags: { ...tags, name: 'GET /contacts?q', endpoint: 'search' },
  });
  check(list, { 'listagem 200': (r) => r.status === 200 });
  check(search, { 'busca 200': (r) => r.status === 200 });
}
