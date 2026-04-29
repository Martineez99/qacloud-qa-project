import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  // — Locators —
  get loginRegisterButton() {
    return this.page.getByRole('button', { name: 'Login / Register' });
  }
  get loginButton() {
    return this.page.getByRole('button', { name: 'Login', exact: true });
  }

  get usernameInput() {
    return this.page.getByRole('textbox', { name: 'Username or Email' });
  }

  get passwordInput() {
    return this.page.getByRole('textbox', { name: 'Password' });
  }

  get submitLoginButton() {
    return this.page.locator('#loginForm').getByRole('button', { name: 'Login' });
  }

  get errorMessage() {
    return this.page.getByText('Invalid username or password');
    
  }

  get userMenuOrAvatar() {
    // Indicador visual de sesión iniciada — ajustar al selector real
    return this.page.locator('#headerUsername').first();
  }

  // — Actions —
  async navigate(): Promise<void> {
    await this.page.goto('/');
    await this.waitForPageLoad();
  }

  async login(username: string, password: string): Promise<void> {
    await this.loginRegisterButton.click();
    await this.loginButton.click();
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitLoginButton.click();
  }

  async loginAsDefaultUser(): Promise<void> {
    const username = process.env.QACLOUD_USERNAME ?? '';
    const password = process.env.QACLOUD_PASSWORD ?? '';
    await this.login(username, password);
  }

  async expectLoggedIn(): Promise<void> {
    await expect(this.userMenuOrAvatar).toBeVisible({ timeout: 10_000 });
  }
}