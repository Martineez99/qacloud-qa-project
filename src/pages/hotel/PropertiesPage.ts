import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PropertyData {
  // Required fields
  name: string;
  city: string;
  country: string;
  address: string;
  // Optional fields
  starRating?: '1' | '2' | '3' | '4' | '5';
  postalCode?: string;
  phone?: string;
  email?: string;
  checkInTime?: string;   // format: "HH:MM"
  checkOutTime?: string;  // format: "HH:MM"
  description?: string;
  cancellationPolicy?: string;
}

// ── Page Object ───────────────────────────────────────────────────────────────

export class PropertiesPage extends BasePage {

  constructor(page: Page) {
    super(page);
  }

  // ── Form Locators ─────────────────────────────────────────────────────────

  get inputName(): Locator {
    return this.page.locator('#propName');
  }

  get inputCity(): Locator {
    return this.page.locator('#propCity');
  }

  get inputCountry(): Locator {
    return this.page.locator('#propCountry');
  }

  get selectStarRating(): Locator {
    return this.page.locator('#propStarRating');
  }

  get inputAddress(): Locator {
    return this.page.locator('#propAddress');
  }

  get inputPostalCode(): Locator {
    return this.page.locator('#propPostalCode');
  }

  get inputPhone(): Locator {
    return this.page.locator('#propPhone');
  }

  get inputEmail(): Locator {
    return this.page.locator('#propEmail');
  }

  get inputCheckInTime(): Locator {
    return this.page.locator('#propCheckInTime');
  }

  get inputCheckOutTime(): Locator {
    return this.page.locator('#propCheckOutTime');
  }

  get textareaDescription(): Locator {
    return this.page.locator('#propDescription');
  }

  get textareaCancellationPolicy(): Locator {
    return this.page.locator('#propCancellationPolicy');
  }

  get submitButton(): Locator {
    return this.page.locator('#propertyForm button[type="submit"]');
  }

  // ── Table Locators ────────────────────────────────────────────────────────

  get tableBody(): Locator {
    return this.page.locator('#propertiesBody');
  }

  get tableRows(): Locator {
    return this.page.locator('#propertiesBody tr');
  }

  /**
   * Localiza la fila completa por el nombre de la propiedad.
   * Usamos filter por texto porque los botones Delete tienen el UUID
   * embebido en el onclick y no hay data-testid.
   */
  getPropertyRow(propertyName: string): Locator {
    return this.page.locator('#propertiesBody tr').filter({ hasText: propertyName });
  }

  /**
   * Localiza el botón Delete de una propiedad específica por nombre.
   */
  getDeleteButton(propertyName: string): Locator {
    return this.getPropertyRow(propertyName).locator('button.btn-danger');
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Rellena solo los campos requeridos del formulario.
   */
  async fillPropertyForm(data: Pick<PropertyData, 'name' | 'city' | 'country' | 'address'>): Promise<void> {
    await this.clearAndType(this.inputName, data.name);
    await this.clearAndType(this.inputCity, data.city);
    await this.clearAndType(this.inputCountry, data.country);
    await this.clearAndType(this.inputAddress, data.address);
  }

  /**
   * Rellena todos los campos del formulario, incluidos los opcionales.
   * Solo escribe en los opcionales si vienen en el objeto data.
   */
  async fillPropertyFormFull(data: PropertyData): Promise<void> {
    await this.fillPropertyForm(data);

    if (data.starRating) {
      await this.selectStarRating.selectOption(data.starRating);
    }
    if (data.postalCode) {
      await this.clearAndType(this.inputPostalCode, data.postalCode);
    }
    if (data.phone) {
      await this.clearAndType(this.inputPhone, data.phone);
    }
    if (data.email) {
      await this.clearAndType(this.inputEmail, data.email);
    }
    if (data.checkInTime) {
      await this.clearAndType(this.inputCheckInTime, data.checkInTime);
    }
    if (data.checkOutTime) {
      await this.clearAndType(this.inputCheckOutTime, data.checkOutTime);
    }
    if (data.description) {
      await this.clearAndType(this.textareaDescription, data.description);
    }
    if (data.cancellationPolicy) {
      await this.clearAndType(this.textareaCancellationPolicy, data.cancellationPolicy);
    }
  }

  /**
   * Envía el formulario de creación de propiedad.
   */
  async submitPropertyForm(): Promise<void> {
    await this.submitButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Método conveniente: rellena campos requeridos y envía.
   */
  async createProperty(data: Pick<PropertyData, 'name' | 'city' | 'country' | 'address'>): Promise<void> {
    await this.fillPropertyForm(data);
    await this.submitPropertyForm();
  }

  /**
   * Método conveniente: rellena todos los campos y envía.
   */
  async createPropertyFull(data: PropertyData): Promise<void> {
    await this.fillPropertyFormFull(data);
    await this.submitPropertyForm();
  }

  /**
   * Elimina una propiedad por nombre.
   * Gestiona el diálogo de confirmación del navegador si aparece.
   */
  async deleteProperty(propertyName: string): Promise<void> {
    this.page.once('dialog', dialog => dialog.accept());
    await this.getDeleteButton(propertyName).click();
    await this.waitForPageLoad();
  }

  /**
   * Devuelve el número de filas en la tabla de propiedades.
   */
  async getPropertyCount(): Promise<number> {
    return this.tableRows.count();
  }
}
