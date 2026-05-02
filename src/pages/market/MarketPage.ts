import { Page, Locator } from '@playwright/test';
import { BasePage } from '../common/BasePage';

export class MarketPage extends BasePage {
  constructor(page: Page) {
    super(page);
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

  async saveProduct() {
    await this.saveProductButton.click();
    await this.page.waitForLoadState('networkidle');
  }
}