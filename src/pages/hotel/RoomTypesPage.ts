import { type Locator, type Page } from '@playwright/test';
import { BasePage } from '../common/BasePage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type BedType = 'Single' | 'Double' | 'Queen' | 'King' | 'Twin';

export interface RoomTypeData {
  // Required fields
  propertyName: string;   // texto visible en el select, ej: "Grand Plaza Hotel - New York"
  roomName: string;
  bedType: BedType;
  maxOccupancy: number;
  pricePerNight: number;
  totalRooms: number;
  // Optional fields
  roomSize?: number;       // en m²
  description?: string;
  amenities?: string;      // comma-separated, ej: "WiFi, TV, AC"
}

// ── Page Object ───────────────────────────────────────────────────────────────

export class RoomTypesPage extends BasePage {

  constructor(page: Page) {
    super(page);
  }

  // ── Form Locators ─────────────────────────────────────────────────────────

  get selectProperty(): Locator {
    return this.page.locator('#roomPropertyId');
  }

  get inputRoomName(): Locator {
    return this.page.locator('#roomName');
  }

  get selectBedType(): Locator {
    return this.page.locator('#roomBedType');
  }

  get inputMaxOccupancy(): Locator {
    return this.page.locator('#roomMaxOccupancy');
  }

  get inputRoomSize(): Locator {
    return this.page.locator('#roomSize');
  }

  get inputPricePerNight(): Locator {
    return this.page.locator('#roomPrice');
  }

  get inputTotalRooms(): Locator {
    return this.page.locator('#roomTotalRooms');
  }

  get textareaDescription(): Locator {
    return this.page.locator('#roomDescription');
  }

  get inputAmenities(): Locator {
    return this.page.locator('#roomAmenities');
  }

  get submitButton(): Locator {
    return this.page.locator('#roomForm button[type="submit"]');
  }

  // ── Table Locators ────────────────────────────────────────────────────────

  get tableBody(): Locator {
    return this.page.locator('#roomsBody');
  }

  get tableRows(): Locator {
    return this.page.locator('#roomsBody tr');
  }

  /**
   * Localiza la fila completa por el nombre del tipo de habitación.
   * Si hay varias filas con el mismo nombre (habitaciones en distintas
   * propiedades), usa el índice nth() para seleccionar la correcta.
   */
  getRoomTypeRow(roomName: string): Locator {
    return this.page.locator('#roomsBody tr').filter({ hasText: roomName });
  }

  /**
   * Localiza el botón Delete de un tipo de habitación por nombre.
   */
  getDeleteButton(roomName: string): Locator {
    return this.getRoomTypeRow(roomName).locator('button.btn-danger');
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Selecciona la propiedad en el dropdown.
   * El select se puebla dinámicamente con las propiedades existentes.
   * Seleccionamos por texto visible (ej: "Grand Plaza Hotel - New York").
   */
  async selectPropertyByName(propertyName: string): Promise<void> {
    await this.selectProperty.selectOption({ label: propertyName });
  }

  /**
   * Rellena los campos requeridos del formulario.
   * Nota: selectPropertyByName debe llamarse antes de este método.
   */
  async fillRoomTypeForm(data: Omit<RoomTypeData, 'propertyName'>): Promise<void> {
    await this.clearAndType(this.inputRoomName, data.roomName);
    await this.selectBedType.selectOption(data.bedType);
    await this.clearAndType(this.inputMaxOccupancy, String(data.maxOccupancy));
    await this.clearAndType(this.inputPricePerNight, String(data.pricePerNight));
    await this.clearAndType(this.inputTotalRooms, String(data.totalRooms));

    if (data.roomSize !== undefined) {
      await this.clearAndType(this.inputRoomSize, String(data.roomSize));
    }
    if (data.description) {
      await this.clearAndType(this.textareaDescription, data.description);
    }
    if (data.amenities) {
      await this.clearAndType(this.inputAmenities, data.amenities);
    }
  }

  /**
   * Envía el formulario de creación de tipo de habitación.
   */
  async submitRoomTypeForm(): Promise<void> {
    await this.submitButton.click();
    await this.waitForPageLoad();
  }

  /**
   * Método conveniente: selecciona property + rellena form + envía.
   */
  async createRoomType(data: RoomTypeData): Promise<void> {
    await this.selectPropertyByName(data.propertyName);
    await this.fillRoomTypeForm(data);
    await this.submitRoomTypeForm();
  }

  /**
   * Elimina un tipo de habitación por nombre.
   * Gestiona el diálogo de confirmación del navegador si aparece.
   */
  async deleteRoomType(roomName: string): Promise<void> {
    this.page.once('dialog', dialog => dialog.accept());
    await this.getDeleteButton(roomName).click();
    await this.waitForPageLoad();
  }

  /**
   * Devuelve el número de filas en la tabla de tipos de habitación.
   */
  async getRoomTypeCount(): Promise<number> {
    return this.tableRows.count();
  }
}
