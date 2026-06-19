import { test, expect } from '@playwright/test';

test('app loads: login screen renders with user buttons (visual smoke)', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto('/index.html');

  await expect(page.locator('#loginScreen')).toBeVisible();
  await expect(page.locator('h1')).toHaveText('Reward Math');
  await expect(page.locator('.user-btn')).toHaveCount(3);
  await expect(page.locator('.user-btn[data-user="Tom"]')).toBeVisible();

  expect(errors, `console/page errors: ${errors.join('\n')}`).toEqual([]);
});
