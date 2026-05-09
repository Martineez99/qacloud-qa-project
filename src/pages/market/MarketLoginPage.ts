import { Page, expect } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class MarketLoginPage extends BasePage {

  // ── Locators ──────────────────────────────────────────────────────────────

  /** Campo username — readonly, ya tiene "tester" como valor por defecto */
  get usernameInput() {
    return this.page.locator('#username');
  }

  /** Campo API Token (password) */
  get apiTokenInput() {
    return this.page.locator('#password');
  }

  /** Botón submit "Open App" */
  get openAppBtn() {
    return this.page.locator('#loginBtn');
  }

  /** Mensaje de error — visible solo si el token es inválido */
  get errorMessage() {
    return this.page.locator('#errorMessage');
  }

  // ── Actions ───────────────────────────────────────────────────────────────

    async navigate(): Promise<void> {
    const username = process.env.QACLOUD_USERNAME ?? '';
    await this.page.goto(`/app-login.html?user=${username}&app=market`);
    await this.waitForPageLoad();
    }

  /**
   * Hace login en la Market app con el token dado.
   * El username "tester" ya está pre-rellenado y es readonly — no se toca.
   */
  async loginWithToken(apiToken: string): Promise<void> {
    await this.apiTokenInput.fill(apiToken);
    await this.openAppBtn.click();
  }

  /**
   * Login con las credenciales del .env.
   * Es el método que usa auth.setup.ts.
   */
  async loginAsDefaultUser(): Promise<void> {
    const token = process.env.QACLOUD_API_KEY ?? '';
    await this.loginWithToken(token);
  }

  /** Espera a que la app cargue tras el login exitoso */
    async expectLoggedIn(): Promise<void> {
    await expect(this.page).toHaveURL(/market\.html/, { timeout: 15_000 });
    }

  /** Verifica que el mensaje de error es visible (para tests negativos) */
  async expectLoginError(): Promise<void> {
    await expect(this.errorMessage).toBeVisible();
  }
}