// src/fixtures/platform.setup.ts
import { test as setup } from '@playwright/test';
import path from 'path';
import { LoginPage } from '../pages/common/LoginPage';

const authFile = path.join(__dirname, '../../.auth/platform.json');

setup('authenticate qacloud platform', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.loginAsDefaultUser();
  await loginPage.expectLoggedIn();

  await page.context().storageState({ path: authFile });
});