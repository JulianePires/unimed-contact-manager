import {
  createContactByApi,
  expect,
  expectAccessible,
  newUser,
  registerByApi,
  test,
} from './fixtures';

// T-E2E05: o usuário B não vê o contato do usuário A, nem pela URL (RN06, RNF04)
test('contato de outra conta aparece como não encontrado', async ({
  browser,
  baseURL,
  signedIn: page,
}) => {
  const contact = await createContactByApi(page.request, {
    name: 'Contato Privado de A',
    email: 'privado@empresa.com',
    mobile: '81977665544',
  });
  await page.goto(`/contatos/${contact.id}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Contato Privado de A' })).toBeVisible();

  const contextB = await browser.newContext(baseURL ? { baseURL } : {});
  const pageB = await contextB.newPage();
  await registerByApi(pageB.request, newUser('Pessoa B'));

  await pageB.goto(`/contatos/${contact.id}`);
  await expect(
    pageB.getByRole('heading', { level: 1, name: 'Contato não encontrado' }),
  ).toBeVisible();
  await expect(pageB.getByText('Contato Privado de A')).toHaveCount(0);
  await expectAccessible(pageB);

  const api = await pageB.request.get(`/api/v1/contacts/${contact.id}`);
  expect(api.status()).toBe(404);
  await pageB.goto('/contatos');
  await expect(pageB.getByText('Sua agenda ainda está vazia')).toBeVisible();

  await contextB.close();
});
