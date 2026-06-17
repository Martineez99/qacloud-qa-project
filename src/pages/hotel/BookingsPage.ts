import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface BookingData {
  // Required fields
  propertyName: string;   // texto visible en el select, ej: "Grand Plaza Hotel - New York"
  roomTypeName: string;   // texto visible, se carga dinámicamente al seleccionar property
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;        // formato: "YYYY-MM-DD"
  checkOut: string;       // formato: "YYYY-MM-DD"
  numGuests: number;
  numRooms?: number;      // default 1 en la UI
  // Optional fields
  specialRequests?: string;
}

// ── Page Object ───────────────────────────────────────────────────────────────

export class BookingsPage extends BasePage {

  constructor(page: Page) {
    super(page);
  }

  // ── Stats Dashboard Locators ──────────────────────────────────────────────

  get statCards(): Locator {
    return this.page.locator('#bookingStats .stat-card');
  }

  /**
   * Devuelve el valor numérico de una stat card por su título.
   * Ej: getStatValue('Total Bookings') → '5'
   */
  getStatCard(title: string): Locator {
    return this.page
      .locator('#bookingStats .stat-card')
      .filter({ hasText: title });
  }

  // ── Form Locators ─────────────────────────────────────────────────────────

  get propertySelect(): Locator {
    return this.page.locator('#bookingPropertyId');
  }

  /**
   * El select de Room Type empieza vacío y se puebla vía JS
   * cuando se selecciona una property. Siempre esperar a que
   * tenga opciones antes de interactuar.
   */
  get roomTypeSelect(): Locator {
    return this.page.locator('#bookingRoomTypeId');
  }

  get inputGuestName(): Locator {
    return this.page.locator('#bookingGuestName');
  }

  get inputGuestEmail(): Locator {
    return this.page.locator('#bookingGuestEmail');
  }

  get inputGuestPhone(): Locator {
    return this.page.locator('#bookingGuestPhone');
  }

  get inputCheckIn(): Locator {
    return this.page.locator('#bookingCheckIn');
  }

  get inputCheckOut(): Locator {
    return this.page.locator('#bookingCheckOut');
  }

  get inputNumGuests(): Locator {
    return this.page.locator('#bookingNumGuests');
  }

  get inputNumRooms(): Locator {
    return this.page.locator('#bookingNumRooms');
  }

  get textareaSpecialRequests(): Locator {
    return this.page.locator('#bookingSpecialRequests');
  }

  get submitButton(): Locator {
    return this.page.locator('#bookingForm button[type="submit"]');
  }

  // ── Table & Filter Locators ───────────────────────────────────────────────

  get selectStatusFilter(): Locator {
    return this.page.locator('#bookingStatusFilter');
  }

  get tableBody(): Locator {
    return this.page.locator('#bookingsBody');
  }

  get tableRows(): Locator {
    return this.page.locator('#bookingsBody tr');
  }

  /**
   * Localiza la fila completa por el número de confirmación.
   * Ej: "HB20260611-YW2HVP"
   */
  getBookingRow(confirmationNumber: string): Locator {
    return this.page.locator('#bookingsBody tr').filter({ hasText: confirmationNumber });
  }

  /**
   * Localiza el botón Update (amarillo) de una booking específica.
   */
  getUpdateButton(confirmationNumber: string): Locator {
    return this.getBookingRow(confirmationNumber).locator('button.btn-warning');
  }

  /**
   * Localiza el botón Delete (rojo) de una booking específica.
   */
  getDeleteButton(confirmationNumber: string): Locator {
    return this.getBookingRow(confirmationNumber).locator('button.btn-danger');
  }

  /**
   * Localiza el badge de status de una booking específica.
   */
  getStatusBadge(confirmationNumber: string): Locator {
    return this.getBookingRow(confirmationNumber).locator('span.badge');
  }

  // ── Modal Update Status Locators ──────────────────────────────────────────

  get modalSelectNewStatus(): Locator {
    return this.page.locator('#newStatus');
  }

  get modalCancellationReasonGroup(): Locator {
    return this.page.locator('#cancellationReasonGroup');
  }

  get modalTextareaCancellationReason(): Locator {
    return this.page.locator('#cancellationReason');
  }

  get modalUpdateStatusButton(): Locator {
    // Botón "Update Status" dentro del modal — usamos texto para diferenciarlo
    // del submit del booking form
    return this.page.locator('button', { hasText: 'Update Status' });
  }

  get modalCloseButton(): Locator {
    return this.page.locator('#statusModal .close');
  }

  get confirmDialogButton(): Locator {
  return this.page.locator('#confirmDialog button.btn-danger');
}

  // ── Actions — Form ────────────────────────────────────────────────────────

  /**
   * Selecciona la property en el booking form y espera a que
   * el select de Room Types se pueble dinámicamente.
   */
  async selectProperty(propertyName: string): Promise<void> {
    await this.propertySelect.selectOption({ label: propertyName });
    // Esperamos a que el select de Room Type tenga al menos una opción real
    // (más allá del placeholder vacío inicial)
    await this.page.waitForFunction(() => {
      const select = document.querySelector('#bookingRoomTypeId') as HTMLSelectElement;
      return select && select.options.length > 1;
    });
  }

  /**
   * Selecciona el tipo de habitación por texto visible.
   * Debe llamarse DESPUÉS de selectProperty.
   */
  async selectRoomTypeByName(roomTypeName: string): Promise<void> {
    // Las opciones incluyen el precio: "Standard Double Room - $220.00/night"
    // Seleccionamos por valor parcial filtrando la opción que contiene el nombre
    const option = this.roomTypeSelect.locator('option', { hasText: roomTypeName });
    const value = await option.getAttribute('value');
    await this.roomTypeSelect.selectOption(value ?? '');
  }

  /**
   * Rellena todos los campos del booking form.
   */
  async fillBookingForm(data: BookingData): Promise<void> {
    await this.clearAndType(this.inputGuestName, data.guestName);
    await this.clearAndType(this.inputGuestEmail, data.guestEmail);
    await this.clearAndType(this.inputGuestPhone, data.guestPhone);
    await this.clearAndType(this.inputCheckIn, data.checkIn);
    await this.clearAndType(this.inputCheckOut, data.checkOut);
    await this.clearAndType(this.inputNumGuests, String(data.numGuests));

    if (data.numRooms !== undefined) {
      await this.clearAndType(this.inputNumRooms, String(data.numRooms));
    }
    if (data.specialRequests) {
      await this.clearAndType(this.textareaSpecialRequests, data.specialRequests);
    }
  }

  /**
   * Envía el formulario de creación de booking.
   */
  async submitBookingForm(): Promise<void> {
    const rowsBefore = await this.tableRows.count();
    await this.submitButton.click();
    // Esperamos a que aparezca al menos una fila nueva en la tabla
    await this.page.waitForFunction(
      (count) => {
        const rows = document.querySelectorAll('#bookingsBody tr');
        return rows.length > count;
      },
      rowsBefore,
      { timeout: 15_000 }
    );
  }

  /**
   * Método conveniente: selecciona property + room type + rellena form + envía.
   */
  async createBooking(data: BookingData): Promise<void> {
    await this.selectProperty(data.propertyName);
    await this.selectRoomTypeByName(data.roomTypeName);
    await this.fillBookingForm(data);
    await this.submitBookingForm();
  }

  // ── Actions — Table ───────────────────────────────────────────────────────

  /**
   * Filtra la tabla de bookings por status.
   * Usa string vacío para mostrar todos.
   */
  async filterByStatus(status: BookingStatus | ''): Promise<void> {
    await this.selectStatusFilter.selectOption(status);
    await this.waitForPageLoad();
  }

  /**
   * Elimina una booking por número de confirmación.
   * Gestiona el diálogo de confirmación del navegador si aparece.
   */
  async deleteBooking(confirmationNumber: string): Promise<void> {
    await this.getDeleteButton(confirmationNumber).click();
    // El modal HTML custom requiere click explícito en Confirm — no es diálogo nativo
    await this.waitForVisible(this.confirmDialogButton);
    await this.confirmDialogButton.click();
    // Esperamos a que la fila desaparezca del DOM
    await this.getBookingRow(confirmationNumber).waitFor({ state: 'detached', timeout: 10_000 });
  }

  /**
   * Devuelve el texto del badge de status de una booking.
   * Ej: 'PENDING', 'CONFIRMED', etc.
   */
  async getBookingStatus(confirmationNumber: string): Promise<string> {
    return (await this.getStatusBadge(confirmationNumber).textContent() ?? '').trim();
  }

  /**
   * Devuelve el número de filas en la tabla de bookings.
   */
  async getBookingCount(): Promise<number> {
    return this.tableRows.count();
  }

  // ── Actions — Update Status Modal ─────────────────────────────────────────

  /**
   * Abre el modal de Update Status para una booking concreta.
   */
  async openUpdateStatusModal(confirmationNumber: string): Promise<void> {
    await this.getUpdateButton(confirmationNumber).click();
    await this.waitForVisible(this.modalSelectNewStatus);
  }

  /**
   * Actualiza el status de una booking.
   * Si el nuevo status es CANCELLED, usa updateStatusWithReason.
   */
  async updateStatus(confirmationNumber: string, newStatus: BookingStatus): Promise<void> {
    await this.openUpdateStatusModal(confirmationNumber);
    await this.modalSelectNewStatus.selectOption(newStatus);
    await this.modalUpdateStatusButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Actualiza el status a CANCELLED e incluye el motivo de cancelación.
   * El campo de cancellation reason solo aparece cuando se selecciona CANCELLED.
   */
  async updateStatusWithReason(
    confirmationNumber: string,
    reason: string
  ): Promise<void> {
    await this.openUpdateStatusModal(confirmationNumber);
    await this.modalSelectNewStatus.selectOption('CANCELLED');
    // Esperamos a que el textarea de motivo sea visible
    await this.waitForVisible(this.modalCancellationReasonGroup);
    await this.clearAndType(this.modalTextareaCancellationReason, reason);
    await this.modalUpdateStatusButton.click();
    await this.waitForPageLoad();
  }

  // ── Actions — Stats ───────────────────────────────────────────────────────

  /**
   * Devuelve el valor numérico de una stat card por su título.
   * Ej: await getStatValue('Total Bookings') → 3
   */
  async getStatValue(title: string): Promise<string> {
    return (
      await this.getStatCard(title).locator('.stat-value').textContent() ?? ''
    ).trim();
  }
}