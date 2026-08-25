import { test, expect } from '@playwright/test';

test('landing page visual', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('landing-desktop.png', { maxDiffPixelRatio: 0.01 });
});
