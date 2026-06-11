import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/common/LoginPage';
import { NavigationComponent } from '../pages/common/NavigationComponent';
import { MarketPage } from '@pages/market/MarketPage';
import { HotelPage } from '@pages/hotel/HotelPage';


// Definimos qué fixtures exponemos
type BaseFixtures = {
  loginPage: LoginPage;
  nav: NavigationComponent;
  authenticatedPage: LoginPage;
  marketPage: MarketPage;
  hotelPage: HotelPage;
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
    // La sesión viene del storageState — solo navegamos al dashboard
    await page.goto('/profile.html');
    await page.waitForLoadState('networkidle');

    const nav = new NavigationComponent(page);
    await use(nav);
  },

  // ── Market: navega a /market.html ────────────────────
  marketPage: async ({ page }, use) => {
    await page.goto('/market.html');
    await page.waitForLoadState('networkidle');
    const marketPage = new MarketPage(page);
    await use(marketPage);
  },

  hotelPage: async ({ page }, use) => {
    await page.goto('/hotel.html');
    await page.waitForLoadState('networkidle');
    const hotelPage = new HotelPage(page);
    await use(hotelPage);
  },
});

export { expect } from '@playwright/test';