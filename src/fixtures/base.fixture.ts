import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/common/LoginPage';
import { NavigationComponent } from '../pages/common/NavigationComponent';
import { MarketPage } from '@pages/market/MarketPage';

// Definimos qué fixtures exponemos
type BaseFixtures = {
  loginPage: LoginPage;
  nav: NavigationComponent;
  authenticatedPage: LoginPage;
  marketPage: MarketPage;
};

export const test = base.extend<BaseFixtures>({

  // ── Para tests de LOGIN ──────────────────────────────
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await use(loginPage);
  },

  // ── Para tests de NAVEGACIÓN ─────────────────────────
  nav: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.loginAsDefaultUser();
    await loginPage.expectLoggedIn();

    const nav = new NavigationComponent(page);
    await use(nav);
  },

  // ── Market: navega a /market.html ────────────────────
  // MarketPage expone internamente basket y orders como sub-POMs
  // sobre la misma instancia de Page (market.html es una sola página con tabs).
  marketPage: async ({ nav }, use) => {
    await nav.goToApp('market');
    const marketPage = new MarketPage(nav.getActivePage());
    await use(marketPage);
  },
});

export { expect } from '@playwright/test';