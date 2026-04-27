import { test as base, type Page } from '@playwright/test';
import { LoginPage } from '@pages/common/LoginPage';

// ── Tipos del fixture ─────────────────────────────────────────────────────

type BaseFixtures = {
  loginPage: LoginPage;
  authenticatedPage: Page;
};

// ── Fixture ───────────────────────────────────────────────────────────────

export const test = base.extend<BaseFixtures>({

  // loginPage: instancia lista para usar, sin autenticación previa
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  // authenticatedPage: page que ya pasó por login
  // Los tests que lo usan no necesitan hacer login manualmente
  authenticatedPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.loginWithEnvCredentials();
    await use(page);
  },
});

export { expect } from '@playwright/test';