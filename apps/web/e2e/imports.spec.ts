import { expect, expectAccessible, test } from './fixtures';
import { excelCsv, INVALID_ROWS, VALID_ROWS } from './fixtures/win1252';

// T-E2E03: CSV Windows-1252 com `;` e erros → acompanhar → ver erros → baixar → reimportar
test('importação do Excel com erros, download e aviso de arquivo repetido', async ({
  signedIn: page,
}) => {
  const file = excelCsv();

  await page.goto('/importacoes');
  await expect(page.getByRole('heading', { level: 1, name: 'Importações' })).toBeVisible();
  await expectAccessible(page);
  await page.getByLabel(/Arraste o arquivo CSV até aqui/).setInputFiles(file);

  await expect(page.getByRole('heading', { level: 1, name: file.name })).toBeVisible();
  // O worker processa em segundo plano; o polling atualiza a tela a cada 2 s
  await expect(page.getByText('Concluída com erros', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const progress = page.getByRole('progressbar', { name: 'Progresso' });
  await expect(progress).toHaveAttribute(
    'aria-valuenow',
    String(VALID_ROWS.length + INVALID_ROWS.length),
  );
  const counters = page.locator('dl').filter({ hasText: 'Criados' });
  await expect(counters).toContainText(`Criados${String(VALID_ROWS.length)}`);
  await expect(counters).toContainText(`Com erro${String(INVALID_ROWS.length)}`);

  const errors = page.getByRole('table', { name: 'Linhas com erro e seus motivos' });
  await expect(errors.getByRole('rowheader')).toHaveCount(INVALID_ROWS.length);
  await expect(errors).toContainText('Caio Brandão');
  await expect(errors).toContainText('Lúcia Prado');
  await expectAccessible(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Baixar linhas com erro (CSV)' }).click(),
  ]);
  const content = await download.createReadStream().then(
    (stream) =>
      new Promise<string>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
        stream.on('error', reject);
      }),
  );
  expect(content).toContain('motivo');
  expect(content).toContain('Caio Brandão');
  expect(content.trim().split(/\r?\n/)).toHaveLength(INVALID_ROWS.length + 1);

  // A agenda recebeu os nomes com os acentos corretos
  await page.goto('/contatos');
  await expect(page.getByRole('rowheader', { name: 'José Conceição' })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: 'Ângela Araújo' })).toBeVisible();

  await page.goto('/importacoes');
  await page.getByLabel(/Arraste o arquivo CSV até aqui/).setInputFiles(file);
  const duplicate = page.getByRole('dialog', { name: 'Este arquivo já foi importado' });
  await expect(duplicate).toBeVisible();
  await expectAccessible(page);
  await duplicate.getByRole('button', { name: 'Importar novamente' }).click();

  await expect(page.getByRole('heading', { level: 1, name: file.name })).toBeVisible();
  // Reimportar não duplica: as linhas válidas agora são ignoradas (RN11, RN13)
  await expect(page.getByText('Concluída com erros', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const again = page.locator('dl').filter({ hasText: 'Criados' });
  await expect(again).toContainText('Criados0');
  await expect(again).toContainText(`Ignorados${String(VALID_ROWS.length)}`);
});
