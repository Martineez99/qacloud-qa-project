import { test, expect } from '../../fixtures/base.fixture';
import { allure } from 'allure-playwright';

test.describe('Smoke Tests — Login & Navigation', () => {
  
  test.beforeEach(async ({ loginPage }) => {
    await loginPage.navigate();
  });

  // ── LOGIN ──────────────────────────────────────────────────────────────────

  test('login with valid credentials succeeds', {
    tag: ['@smoke', '@auth'],
  }, async ({ loginPage }) => {

    await allure.epic('Platform');
    await allure.feature('Authentication');
    await allure.story('Valid login');
    await allure.severity('critical');

    await loginPage.loginAsDefaultUser();

    await loginPage.expectLoggedIn();

    await expect(loginPage.getCurrentUrl()).resolves.toMatch(/qacloud\.dev/);
  });

  test('login with invalid credentials shows error', {
    tag: ['@smoke', '@auth'],
  }, async ({ loginPage }) => {
    await allure.epic('Platform');
    await allure.feature('Authentication');
    await allure.story('Invalid login');
    await allure.severity('normal');

    // ACT
    await loginPage.login('invalid_user', 'wrong_password');

    // ASSERT
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.userMenuOrAvatar).not.toBeVisible();
  });

  // ── NAVIGATION ─────────────────────────────────────────────────────────────

    test.describe('Navigation — app accessibility', () => {

    const apps = ['market', 'hotel', 'bank', 'tasks', 'rental'] as const;

    for (const app of apps) {
        test(`${app} app loads successfully`, {
        tag: ['@smoke', '@navigation'],
        }, async ({ nav }) => {   // ← nav ya viene autenticado

        await nav.goToApp(app);           // click botón en profile.html
        await nav.expectAppLoaded(app);   // verifica /market.html cargó
        });
    }
    });
});