import { type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  // ── Locators ──────────────────────────────────────────────────────────────

  get usernameInput() {
    return this.page.getByLabel('Username');//##################
  }

  get passwordInput() {
    return this.page.getByLabel('Password');//##################
  }

  get loginButton() {
    return this.page.getByRole('button', { name: /login/i });
  }

  get errorMessage() {
    return this.page.locator('[data-testid="error-message"]');
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async goto(): Promise<void> {
    await this.navigate('/login');
    await this.waitForPageLoad();
  }

  async login(username: string, password: string): Promise<void> {
    await this.clearAndType(this.usernameInput, username);
    await this.clearAndType(this.passwordInput, password);
    await this.loginButton.click();
    await this.waitForPageLoad();
  }

  async loginWithEnvCredentials(): Promise<void> {
    await this.goto();
    await this.login(
      process.env.QACLOUD_USERNAME ?? '',
      process.env.QACLOUD_PASSWORD ?? ''
    );
  }
}