import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

type AppName = 'market' | 'hotel' | 'bank' | 'tasks' | 'rental';

const APP_CONFIG: Record<AppName, { label: string; url: string }> = {
  market: { label: 'Market',      url: '/market.html'      },
  hotel:  { label: 'Hotel',       url: '/hotel.html'       },
  bank:   { label: 'Bank',        url: '/bank.html'        },
  tasks:  { label: 'TaskTracker', url: '/tasktracker.html' },
  rental: { label: 'Rental',      url: '/rental.html'      },
};

export class NavigationComponent extends BasePage {

  // La página activa puede cambiar si se abre una nueva pestaña
  private activePage: Page;

  constructor(page: Page) {
    super(page);
    this.activePage = page; // inicialmente es la misma
  }

  private getAppCard(label: string): Locator {
    return this.activePage
      .locator('.app-card')
      .filter({ has: this.activePage.locator('.app-name', { hasText: label }) });
  }

  private getOpenAppButton(label: string): Locator {
    return this.getAppCard(label).locator('.app-link.primary');
  }

  async goToApp(app: AppName): Promise<void> {
    const { label } = APP_CONFIG[app];

    // El link tiene target="_blank" → capturamos la nueva pestaña
    const [newPage] = await Promise.all([
      this.activePage.context().waitForEvent('page'),
      this.getOpenAppButton(label).click(),
    ]);

    await newPage.waitForLoadState('networkidle');

    // A partir de aquí this.activePage apunta a la nueva pestaña
    this.activePage = newPage;
  }

  async expectAppLoaded(app: AppName): Promise<void> {
    const { url } = APP_CONFIG[app];

    // Usamos activePage, que ya es la nueva pestaña
    await expect(this.activePage).toHaveURL(new RegExp(url));
    await expect(this.activePage).not.toHaveURL('/');
    await expect(this.activePage).not.toHaveURL(/error|404|500/);
  }
}