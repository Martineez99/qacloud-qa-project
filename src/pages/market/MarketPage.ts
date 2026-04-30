import { type Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProductCategory =
  | 'fresh-produce'
  | 'meat-seafood'
  | 'dairy-eggs'
  | 'bakery'
  | 'pantry'
  | 'beverages'
  | 'snacks'
  | 'frozen'
  | 'household'
  | 'other';

export type TemperatureZone = 'Dry' | 'Frozen' | 'Chilled' | 'Room Temperature' | '';
export type WeightedFilter = 'weighted' | 'each' | '';
export type SortOrder = 'asc' | 'desc';

export interface ProductFormData {
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
}

export interface DashboardStats {
  totalProducts: number;
  basketUnits: number;
  orders: number;
  inventoryValue: string;
}

// ── MarketPage ────────────────────────────────────────────────────────────────

/**
 * Page Object for /market — Products tab.
 *
 * Responsabilidades:
 *  - Navegación a la ruta /market
 *  - Switching entre tabs (Products / Basket / Orders)
 *  - Interacciones con el grid de productos: buscar, filtrar, ordenar
 *  - Acciones sobre cards: ADD, ✏️ editar, 🗑️ borrar, 👁️ ver detalles
 *  - Modal de producto: abrir (add / edit), rellenar formulario, guardar, cerrar
 *  - Lectura de stats del dashboard
 *  - Lectura del alert global (#alert)
 */
export class MarketPage extends BasePage {
  readonly url = '/market';

  // ── Header ────────────────────────────────────────────────────────────────

  get basketBadgeBtn(): Locator {
    return this.page.locator('.basket-badge-btn');
  }

  /** Contador numérico sobre el icono del basket en el header */
  get basketBadgeCount(): Locator {
    return this.page.locator('#basketCount');
  }

  get headerUsername(): Locator {
    return this.page.locator('#headerUsername');
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  get tabProducts(): Locator {
    return this.page.locator('.tab').filter({ hasText: 'Products' });
  }

  get tabBasket(): Locator {
    return this.page.locator('.tab').filter({ hasText: 'Basket' });
  }

  get tabOrders(): Locator {
    return this.page.locator('.tab').filter({ hasText: 'Orders' });
  }

  // ── Dashboard stats ───────────────────────────────────────────────────────

  get statTotalProducts(): Locator {
    return this.page.locator('#totalProductsStat');
  }

  get statBasketUnits(): Locator {
    return this.page.locator('#basketItemsStat');
  }

  get statOrders(): Locator {
    return this.page.locator('#ordersStat');
  }

  get statInventoryValue(): Locator {
    return this.page.locator('#inventoryValueStat');
  }

  // ── Products tab ──────────────────────────────────────────────────────────

  get productsGrid(): Locator {
    return this.page.locator('#productsGrid');
  }

  get productsLoading(): Locator {
    return this.page.locator('#productsLoading');
  }

  /** Todas las cards del grid de productos */
  get productCards(): Locator {
    return this.page.locator('#productsGrid .card');
  }

  get resultsCountLabel(): Locator {
    return this.page.locator('#resultsCount');
  }

  get activeFiltersSummary(): Locator {
    return this.page.locator('#activeFiltersSummary');
  }

  get searchInput(): Locator {
    return this.page.locator('#productSearch');
  }

  get sortOrderSelect(): Locator {
    return this.page.locator('#sortOrder');
  }

  get temperatureZoneSelect(): Locator {
    return this.page.locator('#filterTemperatureZone');
  }

  get weightedSelect(): Locator {
    return this.page.locator('#filterWeighted');
  }

  get addProductBtn(): Locator {
    return this.page.locator('button.btn-primary', { hasText: '+ Add Product' });
  }

  get clearFiltersBtn(): Locator {
    return this.page.locator('button.btn-secondary.btn-small', { hasText: 'Clear Filters' });
  }

  // ── Alert global ──────────────────────────────────────────────────────────

  get alert(): Locator {
    return this.page.locator('#alert');
  }

  // ── Product modal ─────────────────────────────────────────────────────────

  get productModal(): Locator {
    return this.page.locator('#productModal');
  }

  get productModalTitle(): Locator {
    return this.page.locator('#productModalTitle');
  }

  get productNameInput(): Locator {
    return this.page.locator('#productName');
  }

  get productCategorySelect(): Locator {
    return this.page.locator('#productCategory');
  }

  get productPriceInput(): Locator {
    return this.page.locator('#productPrice');
  }

  get productStockInput(): Locator {
    return this.page.locator('#productStock');
  }

  /** Botón Submit del formulario de producto */
  get saveProductBtn(): Locator {
    return this.page.locator('#productForm button[type="submit"]');
  }

  get cancelProductBtn(): Locator {
    return this.page.locator('#productForm button.btn-secondary');
  }

  // ── Item details modal ────────────────────────────────────────────────────

  get itemDetailsModal(): Locator {
    return this.page.locator('#itemDetailsModal');
  }

  get itemDetailsTitle(): Locator {
    return this.page.locator('#itemDetailsTitle');
  }

  get itemDetailsContent(): Locator {
    return this.page.locator('#itemDetailsContent');
  }

  get closeItemDetailsBtn(): Locator {
    return this.page.locator('#itemDetailsModal button.btn-secondary');
  }

  // ── Navegación ────────────────────────────────────────────────────────────

  async navigate(): Promise<void> {
    await this.page.goto(this.url);
    await this.waitForPageLoad();
    await this.waitForProductsToLoad();
  }

  // ── Tab switching ─────────────────────────────────────────────────────────

  async goToProductsTab(): Promise<void> {
    await this.tabProducts.click();
    await this.waitForProductsToLoad();
  }

  async goToBasketTab(): Promise<void> {
    await this.tabBasket.click();
    await this.page.locator('#basket-tab').waitFor({ state: 'visible' });
  }

  async goToOrdersTab(): Promise<void> {
    await this.tabOrders.click();
    await this.page.locator('#orders-tab').waitFor({ state: 'visible' });
  }

  // ── Waits de productos ────────────────────────────────────────────────────

  async waitForProductsToLoad(): Promise<void> {
    await this.productsLoading.waitFor({ state: 'hidden' });
    await this.waitForVisible(this.productsGrid);
  }

  // ── Helper: card por nombre ───────────────────────────────────────────────

  /**
   * Retorna el locator de la card cuyo <h3> contiene el nombre exacto.
   * Útil para encadenar acciones sobre un producto concreto.
   */
  getCardByName(productName: string): Locator {
    return this.page.locator('#productsGrid .card').filter({
      has: this.page.locator('h3', { hasText: productName }),
    });
  }

  // ── Búsqueda y filtros ────────────────────────────────────────────────────

  async searchProduct(query: string): Promise<void> {
    await this.clearAndType(this.searchInput, query);
    // El filtrado es onkeyup — no requiere submit
  }

  async sortProducts(order: SortOrder): Promise<void> {
    await this.sortOrderSelect.selectOption(order);
    await this.waitForProductsToLoad();
  }

  async filterByTemperatureZone(zone: TemperatureZone): Promise<void> {
    await this.temperatureZoneSelect.selectOption(zone);
    await this.waitForProductsToLoad();
  }

  async filterByWeighted(type: WeightedFilter): Promise<void> {
    await this.weightedSelect.selectOption(type);
    await this.waitForProductsToLoad();
  }

  /**
   * Activa/desactiva un filtro de categoría del sidebar izquierdo.
   * @param categoryId - valor del id sin prefijo "cat-", ej: 'fresh-produce'
   */
  async toggleCategoryFilter(categoryId: ProductCategory): Promise<void> {
    const checkbox = this.page.locator(`#cat-${categoryId}`);
    const categoryItem = this.page
      .locator('.category-item')
      .filter({ has: checkbox });
    await categoryItem.click();
    await this.waitForProductsToLoad();
  }

  async clearFilters(): Promise<void> {
    await this.clearFiltersBtn.click();
    await this.waitForProductsToLoad();
  }

  // ── Lecturas de estado de productos ──────────────────────────────────────

  async getProductCount(): Promise<number> {
    return this.productCards.count();
  }

  async getResultsCountText(): Promise<string> {
    return (await this.resultsCountLabel.textContent()) ?? '';
  }

  async isProductInGrid(productName: string): Promise<boolean> {
    return this.getCardByName(productName).isVisible();
  }

  async getProductPrice(productName: string): Promise<string> {
    const card = this.getCardByName(productName);
    return (await card.locator('.price').textContent()) ?? '';
  }

  async getProductStock(productName: string): Promise<string> {
    const card = this.getCardByName(productName);
    return (await card.locator('.stock').textContent()) ?? '';
  }

  // ── Acciones sobre cards ──────────────────────────────────────────────────

  /** Hace click en el botón ADD de una card (estado: no está en el basket) */
  async addToBasket(productName: string): Promise<void> {
    const card = this.getCardByName(productName);
    await card.locator('button.btn-small', { hasText: 'ADD' }).click();
  }

  /**
   * Incrementa la cantidad de un producto ya añadido al basket (botón + en la card).
   * Solo disponible cuando el producto ya está en el basket.
   */
  async incrementProductQuantityInCard(productName: string): Promise<void> {
    const card = this.getCardByName(productName);
    await card.locator('.quantity-control button').last().click();
  }

  /**
   * Decrementa la cantidad de un producto en la card (botón -).
   * Si la cantidad llega a 0 el producto se elimina del basket.
   */
  async decrementProductQuantityInCard(productName: string): Promise<void> {
    const card = this.getCardByName(productName);
    await card.locator('.quantity-control button').first().click();
  }

  async getProductQuantityInCard(productName: string): Promise<number> {
    const card = this.getCardByName(productName);
    const qtyText = await card.locator('.quantity-control span').textContent();
    return parseInt(qtyText ?? '0', 10);
  }

  /**
   * Abre el modal de edición de un producto.
   * Requiere hover sobre la card para que los iconos sean clickables.
   */
  async editProduct(productName: string): Promise<void> {
    const card = this.getCardByName(productName);
    await card.hover();
    await card.locator('.card-icon.icon-edit').click();
    await this.waitForVisible(this.productModal);
  }

  /**
   * Elimina un producto.
   * Gestiona el window.confirm() nativo registrando el handler ANTES del click.
   */
  async deleteProduct(productName: string): Promise<void> {
    const card = this.getCardByName(productName);
    await card.hover();
    // Registrar handler del dialog ANTES de hacer click
    this.page.once('dialog', (dialog) => void dialog.accept());
    await card.locator('.card-icon.icon-delete').click();
    await this.waitForProductsToLoad();
  }

  /** Abre el modal de detalles de un producto (icono 👁️) */
  async viewProductDetails(productName: string): Promise<void> {
    const card = this.getCardByName(productName);
    await card.hover();
    await card.locator('.card-icon', { hasText: '👁️' }).click();
    await this.waitForVisible(this.itemDetailsModal);
  }

  async closeItemDetailsModal(): Promise<void> {
    await this.closeItemDetailsBtn.click();
    await this.waitForHidden(this.itemDetailsModal);
  }

  // ── Modal de producto ─────────────────────────────────────────────────────

  async openAddProductModal(): Promise<void> {
    await this.addProductBtn.click();
    await this.waitForVisible(this.productModal);
    await this.waitForVisible(this.productNameInput);
  }

  /**
   * Rellena el formulario del modal de producto.
   * Válido tanto para añadir como para editar (los campos se limpian primero).
   */
  async fillProductForm(data: ProductFormData): Promise<void> {
    await this.clearAndType(this.productNameInput, data.name);
    await this.productCategorySelect.selectOption(data.category);
    await this.clearAndType(this.productPriceInput, String(data.price));
    await this.clearAndType(this.productStockInput, String(data.stock));
  }

  /** Envía el formulario y espera que el modal se cierre y el grid recargue */
  async saveProduct(): Promise<void> {
    await this.saveProductBtn.click();
    await this.waitForHidden(this.productModal);
    await this.waitForProductsToLoad();
  }

  async cancelProductModal(): Promise<void> {
    await this.cancelProductBtn.click();
    await this.waitForHidden(this.productModal);
  }

  // ── Alert ─────────────────────────────────────────────────────────────────

  /**
   * Espera a que el alert sea visible y devuelve su texto.
   * El alert desaparece solo tras 3 segundos.
   */
  async getAlertMessage(): Promise<string> {
    await this.alert.waitFor({ state: 'visible' });
    return (await this.alert.textContent()) ?? '';
  }

  async isAlertSuccess(): Promise<boolean> {
    await this.alert.waitFor({ state: 'visible' });
    return this.alert.evaluate((el) => el.classList.contains('alert-success'));
  }

  async isAlertError(): Promise<boolean> {
    await this.alert.waitFor({ state: 'visible' });
    return this.alert.evaluate((el) => el.classList.contains('alert-error'));
  }

  // ── Dashboard stats ───────────────────────────────────────────────────────

  async getDashboardStats(): Promise<DashboardStats> {
    return {
      totalProducts: parseInt((await this.statTotalProducts.textContent()) ?? '0', 10),
      basketUnits: parseInt((await this.statBasketUnits.textContent()) ?? '0', 10),
      orders: parseInt((await this.statOrders.textContent()) ?? '0', 10),
      inventoryValue: (await this.statInventoryValue.textContent()) ?? '',
    };
  }

  async getBasketBadgeCount(): Promise<number> {
    const text = await this.basketBadgeCount.textContent();
    return parseInt(text ?? '0', 10);
  }
}
