import { Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { PropertiesPage } from './PropertiesPage';
import { RoomTypesPage } from './RoomTypesPage';
import { BookingsPage } from './BookingsPage';
import { ReviewsPage } from './ReviewsPage';

/**
 * HotelPage — punto de entrada al Hotel app.
 *
 * Responsabilidades:
 *  - Navegar a /hotel.html
 *  - Cambiar entre las 4 tabs (Properties, Room Types, Bookings, Reviews)
 *  - Instanciar los sub-POMs que comparten la misma Page
 *
 * Patrón idéntico a MarketPage: una sola página con tabs,
 * sin cambio de URL entre secciones.
 */
export class HotelPage extends BasePage {

  // ── Sub-POMs ──────────────────────────────────────────────────────────────
  // Todos comparten la misma instancia de Page — hotel.html es una SPA con tabs.

  readonly properties: PropertiesPage;
  readonly roomTypes: RoomTypesPage;
  readonly bookings: BookingsPage;
  readonly reviews: ReviewsPage;

  constructor(page: Page) {
    super(page);
    this.properties = new PropertiesPage(page);
    this.roomTypes   = new RoomTypesPage(page);
    this.bookings    = new BookingsPage(page);
    this.reviews     = new ReviewsPage(page);
  }

  // ── Tab Locators ──────────────────────────────────────────────────────────

  get tabProperties() {
    return this.page.locator('button.tab', { hasText: 'Properties' });
  }

  get tabRoomTypes() {
    return this.page.locator('button.tab', { hasText: 'Room Types' });
  }

  get tabBookings() {
    return this.page.locator('button.tab', { hasText: 'Bookings' });
  }

  get tabReviews() {
    return this.page.locator('button.tab', { hasText: 'Reviews' });
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  /**
   * Navega a /hotel.html y espera a que la página cargue completamente.
   * Equivalente a lo que hace el fixture marketPage con /market.html.
   */
  async goto(): Promise<void> {
    await this.navigate('/hotel.html');
    await this.waitForPageLoad();
  }

  /**
   * Activa la tab Properties y espera a que su contenido sea visible.
   */
  async goToProperties(): Promise<void> {
    await this.tabProperties.click();
    await this.waitForVisible(this.page.locator('#properties-tab'));
  }

  /**
   * Activa la tab Room Types y espera a que su contenido sea visible.
   */
  async goToRoomTypes(): Promise<void> {
    await this.tabRoomTypes.click();
    await this.waitForVisible(this.page.locator('#rooms-tab'));
  }

  /**
   * Activa la tab Bookings y espera a que su contenido sea visible.
   */
  async goToBookings(): Promise<void> {
    await this.tabBookings.click();
    // Esperamos al contenedor de la tabla, no al botón de la tab
    await this.waitForVisible(this.page.locator('#bookingsBody'));
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Activa la tab Reviews y espera a que su contenido sea visible.
   */
  async goToReviews(): Promise<void> {
    await this.tabReviews.click();
    await this.waitForVisible(this.page.locator('#reviews-tab'));
  }
}
