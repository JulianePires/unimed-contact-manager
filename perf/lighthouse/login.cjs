// Antes de cada URL do Lighthouse CI: /entrar é auditada sem sessão; as demais, com a conta do perf:seed
let signedIn = false;

module.exports = async (browser, { url }) => {
  if (signedIn || new URL(url).pathname === '/entrar') return;
  const page = await browser.newPage();
  await page.goto(new URL('/entrar', url).href);
  const status = await page.evaluate(
    async (email, password) => {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
        body: JSON.stringify({ email, password }),
      });
      return response.status;
    },
    process.env.PERF_EMAIL || 'perf@contatos.app',
    process.env.PERF_PASSWORD || 'perf-contatos-2026',
  );
  if (status !== 200) throw new Error(`Login do Lighthouse falhou (${status}): rode o perf:seed`);
  signedIn = true;
  await page.close();
};
