import { expect } from '@playwright/test';
import { test } from '@fixtures/base.fixture';

const TEST_PRODUCT = {
  name: 'QA Test Product',
  category: 'beverages',
  price: '9.99',
  stock: '10',
};

test.describe('Market - Products CRUD', () => {

  // ── READ ──────────────────────────────────────────────────────────────────

  test('READ: product list loads with cards visible', async ({ marketPage }) => {
    await expect(marketPage.productCards.first()).toBeVisible();
    const count = await marketPage.productCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('READ: view details modal shows correct product info', async ({ marketPage }) => {
    const firstCard = marketPage.productCards.first();
    const productName = (await marketPage.productName(firstCard).textContent())!.trim();

    await marketPage.openViewDetails(productName);

    await expect(marketPage.itemDetailsModal).toBeVisible();
    await expect(marketPage.itemDetailsTitle).toContainText(productName);

    await marketPage.closeDetailsModalButton.click();
    await expect(marketPage.itemDetailsModal).toBeHidden();
  });

  // ── CREATE ────────────────────────────────────────────────────────────────

  test('CREATE: new product appears in the list after saving', async ({ marketPage }) => {
    await marketPage.openAddProductModal();

    await expect(marketPage.productModal).toBeVisible();
    await expect(marketPage.productModalTitle).toHaveText('Add Product');

    await marketPage.fillProductForm(TEST_PRODUCT);
    await marketPage.saveProduct();

    await expect(marketPage.productCardByName(TEST_PRODUCT.name)).toBeVisible();
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────

  test('UPDATE: edited product reflects new data in the list', async ({ marketPage }) => {
    // Arrange: creamos un producto desde la UI para tener control total
    await marketPage.openAddProductModal();
    await marketPage.fillProductForm({ ...TEST_PRODUCT, name: 'QA Product To Edit' });
    await marketPage.saveProduct();
    await expect(marketPage.productCardByName('QA Product To Edit')).toBeVisible();

    // Act: abrimos el modal de edición
    await marketPage.openEditProduct('QA Product To Edit');

    await expect(marketPage.productModal).toBeVisible();
    await expect(marketPage.productModalTitle).toHaveText('Edit Product');

    await marketPage.fillProductForm({ name: 'QA Product Edited', price: '19.99' });
    await marketPage.saveProduct();

    // Assert: el nuevo nombre aparece y el viejo desaparece
    await expect(marketPage.productCardByName('QA Product Edited')).toBeVisible();
    await expect(marketPage.productCardByName('QA Product To Edit')).toHaveCount(0);
  });

  // ── DELETE ────────────────────────────────────────────────────────────────

  test('DELETE: deleted product is removed from the list', async ({ marketPage }) => {
    // Arrange: creamos un producto específico para borrar
    await marketPage.openAddProductModal();
    await marketPage.fillProductForm({ ...TEST_PRODUCT, name: 'QA Product To Delete' });
    await marketPage.saveProduct();
    await expect(marketPage.productCardByName('QA Product To Delete')).toBeVisible();

    // Act: borramos aceptando el confirm nativo
    await marketPage.deleteProduct('QA Product To Delete');

    // Assert
    await expect(marketPage.productCardByName('QA Product To Delete')).toHaveCount(0);
  });


    test('smoke: product list loads and shows cards', async ({ marketPage }) => {
    await expect(marketPage.productCards.first()).toBeVisible();

    const count = await marketPage.productCards.count();
    expect(count).toBeGreaterThan(0);
    });
});