import { test, expect } from '@playwright/test';

test.describe('@smoke — Platform connectivity', () => {
  test('qacloud.dev is reachable', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
  });
});
