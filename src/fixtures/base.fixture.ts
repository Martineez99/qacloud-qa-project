import { test as base } from '@playwright/test';
import { LoginPage } from '../pages/common/LoginPage';
import { NavigationComponent } from '../pages/common/NavigationComponent';

// Definimos qué fixtures exponemos
type BaseFixtures = {
  loginPage: LoginPage;
  nav: NavigationComponent;
  authenticatedPage: LoginPage; // LoginPage ya con sesión iniciada
};

export const test = base.extend<BaseFixtures>({

  // ── Para tests de LOGIN ──────────────────────────────
  // Llega a la pantalla de login, sin autenticar
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await loginPage.navigate(); // goto('/')
    await use(loginPage);
  },

  // ── Para tests de NAVEGACIÓN ─────────────────────────
  // Hace login como setup, luego entrega NavigationComponent
  // apuntando a profile.html (el dashboard)
  nav: async ({ page }, use) => {
    // 1. Login
    const loginPage = new LoginPage(page);
    await loginPage.navigate();
    await loginPage.loginAsDefaultUser();
    await loginPage.expectLoggedIn(); // espera profile.html

    // 2. Ya autenticado → entregar NavigationComponent
    const nav = new NavigationComponent(page);
    await use(nav);
    // misma instancia de page, misma sesión
  },
});

// Re-exportamos expect para que los tests solo importen desde aquí
export { expect } from '@playwright/test';