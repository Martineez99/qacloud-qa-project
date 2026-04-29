import { test, expect } from '@playwright/test';
import { allure } from 'allure-playwright';

test('allure reporter is working', async ({ page }) => {
  await allure.epic('Infrastructure');
  await allure.feature('Allure Reporter');
  await allure.story('Basic connectivity');
  await allure.severity('normal');

  await page.goto('/');
  await expect(page).toHaveTitle(/.+/); // Cualquier título
});