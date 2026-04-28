import { type Locator, type Page } from '@playwright/test';

export class BasePage {
  constructor(protected page: Page) {}

  // ── Navegación ────────────────────────────────────────────────────────────

  async navigate(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  // ── Waits explícitos ──────────────────────────────────────────────────────

  async waitForVisible(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'visible', timeout });
  }

  async waitForHidden(locator: Locator, timeout = 10000): Promise<void> {
    await locator.waitFor({ state: 'hidden', timeout });
  }

  // ── Scroll ────────────────────────────────────────────────────────────────

  async scrollToElement(locator: Locator): Promise<void> {
    await locator.scrollIntoViewIfNeeded();
  }

  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  // ── Screenshots ───────────────────────────────────────────────────────────

  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({
      path: `reports/screenshots/${name}-${Date.now()}.png`,
      fullPage: true,
    });
  }

  // ── Utilidades ────────────────────────────────────────────────────────────

  async getPageTitle(): Promise<string> {
    return this.page.title();
  }

  async getCurrentUrl(): Promise<string> {
    return this.page.url();
  }

  async clearAndType(locator: Locator, text: string): Promise<void> {
    await locator.clear();
    await locator.fill(text);
  }

  async isElementPresent(locator: Locator): Promise<boolean> {
    return locator.isVisible();
  }

  // ── Tablas y listas ───────────────────────────────────────────────────────

  async getTableRowCount(tableLocator: Locator): Promise<number> {
    return tableLocator.locator('tr').count();
  }

  async getAllTextsFromList(listLocator: Locator): Promise<string[]> {
    return listLocator.allTextContents();
  }
}