import { expect, expectAccessible, test } from './fixtures';

const FIRST = { name: 'Carlos Eduardo Melo', email: 'carlos@empresa.com', mobile: '81988776655' };
const SECOND = { name: 'Carla Menezes', email: 'carla@empresa.com', mobile: '(81) 98877-6655' };

// T-E2E02: cadastrar → inativar → cadastrar outro com o mesmo celular → reativar pela sugestão
test('celular de contato inativo oferece reativar o contato', async ({ signedIn: page }) => {
  await page.goto('/contatos/novo');
  await expect(page.getByRole('heading', { level: 1, name: 'Novo contato' })).toBeVisible();
  await expectAccessible(page);
  await page.getByLabel('Nome').fill(FIRST.name);
  await page.getByLabel('E-mail').fill(FIRST.email);
  await page.getByLabel('Celular').fill(FIRST.mobile);
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();

  await expect(page.getByRole('heading', { level: 1, name: FIRST.name })).toBeVisible();
  await expect(page.getByText('(81) 98877-6655')).toBeVisible();
  const firstUrl = page.url();
  await expectAccessible(page);

  await page.getByRole('button', { name: 'Inativar' }).click();
  const dialog = page.getByRole('alertdialog', { name: `Inativar ${FIRST.name}?` });
  await expectAccessible(page);
  await dialog.getByRole('button', { name: 'Inativar contato' }).click();
  await expect(page.getByText('Inativo', { exact: true })).toBeVisible();

  await page.goto('/contatos/novo');
  await page.getByLabel('Nome').fill(SECOND.name);
  await page.getByLabel('E-mail').fill(SECOND.email);
  await page.getByLabel('Celular').fill(SECOND.mobile);
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();

  const alert = page.getByRole('alert', { name: 'Este celular pertence a um contato inativo' });
  await expect(alert).toBeVisible();
  await expectAccessible(page);
  await alert.getByRole('button', { name: `Reativar ${FIRST.name}` }).click();

  await expect(page.getByRole('heading', { level: 1, name: FIRST.name })).toBeVisible();
  await expect(page).toHaveURL(firstUrl);
  await expect(page.getByText('Ativo', { exact: true })).toBeVisible();
  await expectAccessible(page);
});
