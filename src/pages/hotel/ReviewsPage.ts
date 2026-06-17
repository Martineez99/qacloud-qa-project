import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type StarRatingId =
  | 'overallRating'
  | 'cleanlinessRating'
  | 'serviceRating'
  | 'locationRating'
  | 'valueRating';

export type StarValue = 1 | 2 | 3 | 4 | 5;

export interface ReviewData {
  // La booking a revisar — texto visible en el select
  // Ej: "Diego - Grand Plaza Hotel - Checked out on 17/6/2026"
  bookingText: string;
  // Ratings — overall es obligatorio, los demás opcionales
  overallRating: StarValue;
  cleanlinessRating?: StarValue;
  serviceRating?: StarValue;
  locationRating?: StarValue;
  valueRating?: StarValue;
  comment?: string;
}

// ── Page Object ───────────────────────────────────────────────────────────────

export class ReviewsPage extends BasePage {

  constructor(page: Page) {
    super(page);
  }

  // ── Table Locators ────────────────────────────────────────────────────────

  get tableBody(): Locator {
    return this.page.locator('#reviewsBody');
  }

  get tableRows(): Locator {
    return this.page.locator('#reviewsBody tr');
  }

  /**
   * Localiza la fila de una review por el nombre del huésped.
   */
  getReviewRow(guestName: string): Locator {
    return this.page.locator('#reviewsBody tr').filter({ hasText: guestName });
  }

  // ── Modal Locators ────────────────────────────────────────────────────────

  get modal(): Locator {
    return this.page.locator('#reviewModal');
  }

  get openModalButton(): Locator {
    return this.page.locator('button', { hasText: '➕ Add Review' });
  }

  get selectBooking(): Locator {
    return this.page.locator('#reviewBookingSelect');
  }

  /**
   * La sección del formulario está oculta (display:none) hasta que
   * se selecciona una booking con status CHECKED_OUT.
   */
  get reviewFormSection(): Locator {
    return this.page.locator('#reviewFormSection');
  }

  get textareaComment(): Locator {
    return this.page.locator('#reviewComment');
  }

  get submitReviewButton(): Locator {
    return this.page.locator('button', { hasText: 'Submit Review' });
  }

  get closeModalButton(): Locator {
    return this.page.locator('#reviewModal .close');
  }

  // ── Star Rating Locators ──────────────────────────────────────────────────

  /**
   * Devuelve todas las estrellas de un grupo de rating concreto.
   * Ej: getStarLocators('overallRating') → los 5 spans del rating global
   */
  getStarLocators(ratingId: StarRatingId): Locator {
    return this.page.locator(`#${ratingId} .star`);
  }

  /**
   * Devuelve la estrella concreta por valor (1-5) dentro de un grupo.
   * Usamos data-value en lugar de nth() para mayor claridad y resistencia
   * a cambios en el orden del DOM.
   */
  getStar(ratingId: StarRatingId, value: StarValue): Locator {
    return this.page.locator(`#${ratingId} .star[data-value="${value}"]`);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Abre el modal de Add Review.
   */
  async openAddReviewModal(): Promise<void> {
    await this.openModalButton.click();
    await this.waitForVisible(this.modal);
    // Esperamos a que el select se pueble vía JS — arranca vacío con solo el placeholder
    await this.page.waitForFunction(
      () => {
        const select = document.querySelector('#reviewBookingSelect') as HTMLSelectElement;
        return select && select.options.length > 1;
      },
      { timeout: 10_000 }
    );
  }

  /**
   * Selecciona la booking a revisar en el dropdown del modal.
   * Solo aparecen bookings con status CHECKED_OUT.
   * El texto debe coincidir con el label visible del option.
   */
  async selectBookingForReview(bookingText: string): Promise<void> {
    await this.selectBooking.selectOption({ label: bookingText });
    // Esperamos a que el formulario de review sea visible
    await this.waitForVisible(this.reviewFormSection);
  }

  /**
   * Hace clic en la estrella correcta de un grupo de rating.
   * Método genérico usado por los setters específicos.
   */
  async setStarRating(ratingId: StarRatingId, value: StarValue): Promise<void> {
    await this.getStar(ratingId, value).click();
  }

  async setOverallRating(value: StarValue): Promise<void> {
    await this.setStarRating('overallRating', value);
  }

  async setCleanlinessRating(value: StarValue): Promise<void> {
    await this.setStarRating('cleanlinessRating', value);
  }

  async setServiceRating(value: StarValue): Promise<void> {
    await this.setStarRating('serviceRating', value);
  }

  async setLocationRating(value: StarValue): Promise<void> {
    await this.setStarRating('locationRating', value);
  }

  async setValueRating(value: StarValue): Promise<void> {
    await this.setStarRating('valueRating', value);
  }

  /**
   * Rellena el textarea de comentario.
   */
  async fillComment(text: string): Promise<void> {
    await this.clearAndType(this.textareaComment, text);
  }

  /**
   * Envía el formulario de review.
   */
  async submitReview(): Promise<void> {
    await this.submitReviewButton.click();
    // Esperamos a que la tabla se actualice — la review aparece vía JS tras el submit
    await this.page.waitForFunction(
      () => document.querySelectorAll('#reviewsBody tr').length > 0,
      { timeout: 10_000 }
    );
  }

  /**
   * Cierra el modal sin enviar la review.
   */
  async closeModal(): Promise<void> {
    await this.closeModalButton.click();
    await this.waitForHidden(this.modal);
  }

  /**
   * Método conveniente: abre modal + selecciona booking + rellena ratings + envía.
   */
  async addReview(data: ReviewData): Promise<void> {
    await this.openAddReviewModal();
    await this.selectBookingForReview(data.bookingText);

    await this.setOverallRating(data.overallRating);

    if (data.cleanlinessRating) await this.setCleanlinessRating(data.cleanlinessRating);
    if (data.serviceRating)     await this.setServiceRating(data.serviceRating);
    if (data.locationRating)    await this.setLocationRating(data.locationRating);
    if (data.valueRating)       await this.setValueRating(data.valueRating);
    if (data.comment)           await this.fillComment(data.comment);

    await this.submitReview();
  }

  /**
   * Devuelve el número de reviews en la tabla.
   */
  async getReviewCount(): Promise<number> {
    return this.tableRows.count();
  }
}
