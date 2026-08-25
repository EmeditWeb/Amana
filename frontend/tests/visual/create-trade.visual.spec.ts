import { test, expect } from '@playwright/test';

test('create trade page visual', async ({ page }) => {
  await page.goto('/trades/create');
  await expect(page).toHaveScreenshot('create-trade-desktop.png', { maxDiffPixelRatio: 0.01 });
});
