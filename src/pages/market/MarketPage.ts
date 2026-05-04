import { Page, Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';
import { OrdersPage } from './OrdersPage';
import { BasketPage } from './BasketPage';

export class MarketPage extends BasePage {

    /**
   * Sub-POM para el tab Basket.
   * Comparte la misma instancia de Page — market.html es una sola página
   * con tabs; no hay cambio de URL entre Products, Basket y Orders.
   */
  readonly basket: BasketPage;
 
  /**
   * Sub-POM para el tab Orders.
   * Misma instancia de Page que basket y products.
   */
  readonly orders: OrdersPage;

  constructor(page: Page) {
    super(page);
    this.basket = new BasketPage(page);   // mismo page
    this.orders = new OrdersPage(page);   // mismo page
  }


  // ── Product List Locators ───────────────────────────
  get productCards(): Locator {
    return this.page.locator('.card');
  }

  productCardByName(name: string): Locator {
    return this.page.locator('.card', { hasText: name });
  }

  productName(card: Locator): Locator {
    return card.locator('h3');
  }

  productPrice(card: Locator): Locator {
    return card.locator('.price');
  }

  productStock(card: Locator): Locator {
    return card.locator('.stock');
  }

  productCategory(card: Locator): Locator {
    return card.locator('.category');
  }

  addButton(card: Locator): Locator {
    return card.locator('.btn.btn-small', { hasText: 'ADD' });
  }

  get addProductButton(): Locator {
  return this.page.locator('button.btn.btn-primary', { hasText: '+ Add Product' });
}

  // ── Card Quantity Control (after ADD is clicked) ────
  // Once a product is added, .card-actions shows a quantity-control
  // instead of the ADD button.
 
  cardQuantityControl(card: Locator): Locator {
    return card.locator('.quantity-control');
  }
 
  /** Current quantity shown in the card quantity-control span */
  cardCurrentQuantity(card: Locator): Locator {
    return card.locator('.quantity-control span');
  }
 
  /** The + button inside the card quantity-control (index 1) */
  cardIncrementBtn(card: Locator): Locator {
    return card.locator('.quantity-control .btn.btn-small').nth(1);
  }
 
  /** The - button inside the card quantity-control (index 0) */
  cardDecrementBtn(card: Locator): Locator {
    return card.locator('.quantity-control .btn.btn-small').nth(0);
  }
 
  /** Out of Stock button — disabled, present when stock = 0 */
  outOfStockBtn(card: Locator): Locator {
    return card.locator('button[disabled]', { hasText: 'Out of Stock' });
  }

  // ── Hover Actions (view/edit/delete icons) ──────────
  viewDetailsButton(card: Locator): Locator {
    return card.locator('.card-icon[title="View Details"]');
  }

  editButton(card: Locator): Locator {
    return card.locator('.card-icon.icon-edit');
  }

  deleteButton(card: Locator): Locator {
    return card.locator('.card-icon.icon-delete');
  }

  async hoverCard(card: Locator) {
    await card.hover();
  }

  // ── Item Details Modal ──────────────────────────────
  get itemDetailsModal(): Locator {
    return this.page.locator('#itemDetailsModal');
  }

  get itemDetailsTitle(): Locator {
    return this.page.locator('#itemDetailsTitle');
  }

  get closeDetailsModalButton(): Locator {
    return this.page.locator('#itemDetailsModal .close-btn');
  }

  // ── Edit/Create Product Modal ───────────────────────
  get productModal(): Locator {
    return this.page.locator('#productModal');
  }

  get productModalTitle(): Locator {
    return this.page.locator('#productModalTitle');
  }

  get inputProductName(): Locator {
    return this.page.locator('#productName');
  }

  get selectProductCategory(): Locator {
    return this.page.locator('#productCategory');
  }

  get inputProductPrice(): Locator {
    return this.page.locator('#productPrice');
  }

  get inputProductStock(): Locator {
    return this.page.locator('#productStock');
  }

  get saveProductButton(): Locator {
    return this.page.locator('#productForm button[type="submit"]');
  }

  get cancelProductModalButton(): Locator {
    return this.page.locator('#productModal .btn.btn-secondary');
  }

  // ── High-level Actions ──────────────────────────────

  async openAddProductModal(): Promise<void> {
    await this.addProductButton.click();
    await this.waitForVisible(this.productModal);
  }

  async openViewDetails(productName: string) {
    const card = this.productCardByName(productName);
    await this.hoverCard(card);
    await this.viewDetailsButton(card).click();
  }

  async openEditProduct(productName: string) {
    const card = this.productCardByName(productName);
    await this.hoverCard(card);
    await this.editButton(card).click();
  }

  async deleteProduct(productName: string): Promise<void> {
    const card = this.productCardByName(productName);
    await this.hoverCard(card);
    this.page.once('dialog', dialog => dialog.accept());
    await this.deleteButton(card).click();
    await this.waitForPageLoad();
  }

  async fillProductForm(data: {
    name?: string;
    category?: string;
    price?: string;
    stock?: string;
  }) {
    if (data.name !== undefined) {
      await this.inputProductName.clear();
      await this.inputProductName.fill(data.name);
    }
    if (data.category !== undefined) {
      await this.selectProductCategory.selectOption(data.category);
    }
    if (data.price !== undefined) {
      await this.inputProductPrice.clear();
      await this.inputProductPrice.fill(data.price);
    }
    if (data.stock !== undefined) {
      await this.inputProductStock.clear();
      await this.inputProductStock.fill(data.stock);
    }
  }
    // ── Basket Interaction ──────────────────────────────
 
  /**
   * Clicks the ADD button on a product card and waits for the quantity-control
   * to appear, confirming the item was added to the basket.
   * Only works when the card is in its initial ADD state (not already added).
   */
  async addProductToBasket(productName: string): Promise<void> {
    const card = this.productCardByName(productName);

    // Registramos la espera ANTES del click para no perder la respuesta
    const basketResponse = this.page.waitForResponse(
      response =>
        response.url().includes('/api/basket') &&
        response.request().method() === 'POST' &&
        response.status() === 201
    );

  await this.addButton(card).click();

  // Esperamos a que la API confirme el add (201 Created)
  await basketResponse;

  // Ahora sí esperamos el DOM — la API ya respondió, el re-render es inmediato
  await this.cardQuantityControl(card).waitFor({ state: 'visible' });
}
 
  /**
   * Returns the name of the product at the given zero-based index in the list.
   * Useful when you need multiple products without hardcoding names.
   */
  async getProductNameAtIndex(index: number): Promise<string> {
    const card = this.productCards.nth(index);
    return ((await this.productName(card).textContent()) ?? '').trim();
  }
 
  /**
   * Reads the current quantity shown in the card quantity-control.
   * Returns 0 if the card is not in the "already added" state.
   */
  async getCardQuantity(productName: string): Promise<number> {
    const card = this.productCardByName(productName);
    const text = await this.cardCurrentQuantity(card).textContent();
    return parseInt(text ?? '0', 10);
  }
 
  /**
   * Returns true if the product card shows an "Out of Stock" disabled button.
   */
  async isOutOfStock(productName: string): Promise<boolean> {
    const card = this.productCardByName(productName);
    return this.outOfStockBtn(card).isVisible();
  }

  async saveProduct() {
    await this.saveProductButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}