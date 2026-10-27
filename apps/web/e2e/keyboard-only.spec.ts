import type { Locator, Page } from '@playwright/test';

import { expect, expectAccessible, test } from './fixtures';

const FIRST = { name: 'Beatriz Lins', email: 'beatriz@empresa.com', mobile: '81987654321' };
const SECOND = { name: 'Bruno Lins', email: 'bruno@empresa.com', mobile: '(81) 98765-4321' };

async function tabTo(page: Page, target: Locator, { backwards = false } = {}): Promise<void> {
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
    if (await target.evaluate((element) => element === document.activeElement)) return;
  }
  await expect(target).toBeFocused();
}

async function fillByKeyboard(page: Page, contact: typeof FIRST): Promise<void> {
  await tabTo(page, page.getByLabel('Nome'));
  await page.keyboard.type(contact.name);
  await tabTo(page, page.getByLabel('E-mail'));
  await page.keyboard.type(contact.email);
  await tabTo(page, page.getByLabel('Celular'));
  await page.keyboard.type(contact.mobile);
  await page.keyboard.press('Enter');
}

// T-E2E04: o fluxo do T-E2E02 só com teclado, com axe em cada tela (RNF11)
test('inativar e reativar pela sugestão usando apenas o teclado', async ({
  browserName,
  signedIn: page,
}) => {
  test.skip(
    browserName === 'webkit',
    'Como o Safari padrão, o WebKit não foca links com Tab e o Playwright não liga essa preferência',
  );
  await page.goto('/contatos');
  await expect(page.getByRole('heading', { level: 1, name: 'Contatos' })).toBeVisible();
  await expectAccessible(page);

  await tabTo(page, page.getByRole('link', { name: 'Novo contato' }).first());
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Novo contato' })).toBeVisible();
  await expectAccessible(page);
  await fillByKeyboard(page, FIRST);

  await expect(page.getByRole('heading', { level: 1, name: FIRST.name })).toBeVisible();
  const firstUrl = page.url();
  await expectAccessible(page);

  await tabTo(page, page.getByRole('button', { name: 'Inativar', exact: true }));
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('alertdialog', { name: `Inativar ${FIRST.name}?` });
  await expect(dialog).toBeVisible();
  await expectAccessible(page);
  await tabTo(page, dialog.getByRole('button', { name: 'Inativar contato' }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('Inativo', { exact: true })).toBeVisible();

  await tabTo(
    page,
    page.getByRole('navigation', { name: 'Principal' }).getByRole('link', { name: 'Contatos' }),
    { backwards: true },
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Contatos' })).toBeVisible();
  await tabTo(page, page.getByRole('link', { name: 'Novo contato' }).first());
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Novo contato' })).toBeVisible();
  await fillByKeyboard(page, SECOND);

  const alert = page.getByRole('alert', { name: 'Este celular pertence a um contato inativo' });
  await expect(alert).toBeFocused();
  await expectAccessible(page);
  await tabTo(page, alert.getByRole('button', { name: `Reativar ${FIRST.name}` }));
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { level: 1, name: FIRST.name })).toBeVisible();
  await expect(page).toHaveURL(firstUrl);
  await expect(page.getByText('Ativo', { exact: true })).toBeVisible();
  await expectAccessible(page);
});
