import { expect, expectAccessible, newUser, test } from './fixtures';

// T-E2E01: criar conta → sair → entrar → rota protegida sem sessão volta ao login
test('cadastro, saída, entrada e rota protegida sem sessão', async ({ page }) => {
  const user = newUser('Rita Cavalcanti');

  const response = await page.goto('/criar-conta');
  // T-NF04: a SPA chega com a CSP estrita e Trusted Types (ADR-008)
  expect(response?.headers()['content-security-policy']).toContain(
    "require-trusted-types-for 'script'",
  );
  await expect(page.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel('Nome').fill(user.name);
  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha').fill(user.password);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Contatos' })).toBeVisible();
  await expect(page).toHaveURL('/contatos');
  await expect(page.getByText('Sua agenda ainda está vazia')).toBeVisible();
  await expectAccessible(page);

  await page.getByRole('button', { name: `Conta de ${user.name}` }).click();
  await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
  await expectAccessible(page);

  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Contatos' })).toBeVisible();

  await page.getByRole('button', { name: `Conta de ${user.name}` }).click();
  await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();

  await page.goto('/importacoes');
  await expect(page).toHaveURL('/entrar?redirect=%2Fimportacoes');
  await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();

  await page.getByLabel('E-mail').fill(user.email);
  await page.getByLabel('Senha').fill(user.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Importações' })).toBeVisible();
  await expect(page).toHaveURL('/importacoes');
  await expectAccessible(page);
});
