// src/fixtures/hotel.setup.ts
import { test as setup } from '@playwright/test';
import path from 'path';
import { HotelLoginPage } from '../pages/hotel/HotelLoginPage';

const authFile = path.join(__dirname, '../../.auth/hotel.json');

setup('authenticate hotel app', async ({ page }) => {
  const loginPage = new HotelLoginPage(page);

  await loginPage.navigate();
  await loginPage.loginAsDefaultUser();
  await loginPage.expectLoggedIn();

  // Guardar la sesión autenticada para reutilizarla en todos los E2E tests de Hotel
  await page.context().storageState({ path: authFile });
});
