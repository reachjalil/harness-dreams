import { _electron as electron } from 'playwright';
import { expect, test } from '@playwright/test';

test('Electron app launches summary screen', async () => {
  const app = await electron.launch({ args: ['.'] });
  const window = await app.firstWindow();
  await expect(window.getByRole('main')).toBeVisible();
  await expect(window.getByText(/summary/i)).toBeVisible();
  await app.close();
});
