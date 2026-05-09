// src/fixtures/auth.setup.ts
import { test as setup } from '@playwright/test';
import path from 'path';
import { MarketLoginPage } from '../pages/market/MarketLoginPage';

const authFile = path.join(__dirname, '../../.auth/market.json');

setup('authenticate market app', async ({ page }) => {
  const loginPage = new MarketLoginPage(page);

  await loginPage.navigate();
  await loginPage.loginAsDefaultUser();
  await loginPage.expectLoggedIn();

  // Guardar la sesión autenticada para reutilizarla en todos los E2E tests
  await page.context().storageState({ path: authFile });
});