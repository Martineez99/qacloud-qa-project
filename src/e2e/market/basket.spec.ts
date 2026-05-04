import { test, expect } from '@fixtures/base.fixture';

// ─────────────────────────────────────────────────────────────────────────────
// Market — Complete Purchase Journey
//
// market.html es una sola página con tres tabs (Products / Basket / Orders).
// Accedemos a cada sección a través de marketPage.basket y marketPage.orders,
// que comparten la misma instancia de Page.
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Market - Complete Purchase Journey', () => {

    test.describe.configure({ mode: 'serial' }); // 👈 todos en orden, 1 worker


    test.beforeEach(async ({ marketPage }) => {
    // Reset del entorno para garantizar estado determinista:
    // basket vacío, órdenes limpias, productos con stock por defecto.
    await marketPage.getPage().request.post(
      `${process.env.QACLOUD_BASE_URL}/api/reset`,
      { headers: { Authorization: process.env.QACLOUD_API_KEY ?? '' } },
    );
    await marketPage.getPage().reload();
    await marketPage.getPage().waitForLoadState('networkidle');
  });

  // ── HAPPY PATH ─────────────────────────────────────────────────────────────

  test('HAPPY PATH: single product purchase appears in Orders as pending',
    async ({ marketPage }) => {

      // ── ARRANGE ──────────────────────────────────────────────────────────
      const productName = await marketPage.getProductNameAtIndex(0);

      // ── ACT: añadir al basket desde el tab Products ───────────────────────
      await marketPage.addProductToBasket(productName);
      // ── ACT: ir al tab Basket y verificar el item ─────────────────────────
      await marketPage.basket.goToBasketTab();

      await expect(marketPage.basket.basketItems).toHaveCount(1);
      await expect(marketPage.basket.getBasketItemByName(productName)).toBeVisible();

      // ── ACT: hacer el pedido ──────────────────────────────────────────────
      const orderSummary = await marketPage.basket.placeOrder();
      expect(orderSummary.orderNumber).toBeTruthy();
      expect(orderSummary.totalAmount).toBeTruthy();

      // ── ACT: navegar al tab Orders ────────────────────────────────────────
      await marketPage.basket.closeOrderModalAndGoToOrders();
      await marketPage.orders.waitForOrdersToLoad();

      // ── ASSERT: la orden existe con status "pending" ──────────────────────
      const order = await marketPage.orders.getOrderInfo(orderSummary.orderNumber);
      expect(order.status).toBe('pending');
      expect(order.totalAmount).toBeTruthy();
    },
  );

  // ── MULTI-PRODUCT ──────────────────────────────────────────────────────────

  test('MULTI-PRODUCT: two products appear in basket and in order items',
    async ({ marketPage }) => {

      // ── ARRANGE ──────────────────────────────────────────────────────────
      const productA = await marketPage.getProductNameAtIndex(0);
      const productB = await marketPage.getProductNameAtIndex(1);

      // ── ACT: añadir ambos desde el tab Products ───────────────────────────
      await marketPage.addProductToBasket(productA);
      await marketPage.addProductToBasket(productB);

      // ── ACT: verificar basket ─────────────────────────────────────────────
      await marketPage.basket.goToBasketTab();

      await expect(marketPage.basket.basketItems).toHaveCount(2);
      await expect(marketPage.basket.getBasketItemByName(productA)).toBeVisible();
      await expect(marketPage.basket.getBasketItemByName(productB)).toBeVisible();

      const total = await marketPage.basket.getTotalAmount();
      expect(total).toMatch(/^\$[\d,]+\.\d{2}$/);

      // ── ACT: hacer el pedido ──────────────────────────────────────────────
      const orderSummary = await marketPage.basket.placeOrder();

      // ── ACT: verificar items en Orders ────────────────────────────────────
      await marketPage.basket.closeOrderModalAndGoToOrders();
      await marketPage.orders.waitForOrdersToLoad();

      const orderItems = await marketPage.orders.getOrderItems(orderSummary.orderNumber);
      const orderItemNames = orderItems.map(i => i.name);

      expect(orderItemNames.some(n => n.includes(productA))).toBe(true);
      expect(orderItemNames.some(n => n.includes(productB))).toBe(true);
    },
  );

  // ── QUANTITY MANAGEMENT ────────────────────────────────────────────────────

  test('QUANTITY: incrementing in basket updates subtotal before checkout',
    async ({ marketPage }) => {

      // ── ARRANGE ──────────────────────────────────────────────────────────
      const productName = await marketPage.getProductNameAtIndex(0);
      await marketPage.addProductToBasket(productName);

      // ── ACT: ir al basket y subir cantidad ───────────────────────────────
      await marketPage.basket.goToBasketTab();

      const subtotalBefore = await marketPage.basket.getItemSubtotal(productName);
      await marketPage.basket.incrementItem(productName);

      // ── ASSERT: cantidad = 2, subtotal aumentó ────────────────────────────
      const quantity = await marketPage.basket.getItemQuantity(productName);
      expect(quantity).toBe(2);

      const subtotalAfter = await marketPage.basket.getItemSubtotal(productName);
      expect(subtotalAfter).not.toBe(subtotalBefore);

      // ── ACT: completar la compra ──────────────────────────────────────────
      const orderSummary = await marketPage.basket.placeOrder();

      await marketPage.basket.closeOrderModalAndGoToOrders();
      await marketPage.orders.waitForOrdersToLoad();

      // ── ASSERT: orden visible en Orders ──────────────────────────────────
      const order = await marketPage.orders.getOrderInfo(orderSummary.orderNumber);
      expect(order.status).toBe('pending');
    },
  );

  // ── REMOVE BEFORE CHECKOUT ─────────────────────────────────────────────────

  test('REMOVE: removing one of two items leaves single item in order',
    async ({ marketPage }) => {

      // ── ARRANGE ──────────────────────────────────────────────────────────
      const productA = await marketPage.getProductNameAtIndex(0);
      const productB = await marketPage.getProductNameAtIndex(1);

      await marketPage.addProductToBasket(productA);
      await marketPage.addProductToBasket(productB);

      // ── ACT: eliminar productA del basket ─────────────────────────────────
      await marketPage.basket.goToBasketTab();
      await marketPage.basket.removeItem(productA);
      await marketPage.basket.waitForBasketToLoad();

      // ── ASSERT: solo queda productB ───────────────────────────────────────
      await expect(marketPage.basket.basketItems).toHaveCount(1);
      await expect(marketPage.basket.getBasketItemByName(productA)).toHaveCount(0);
      await expect(marketPage.basket.getBasketItemByName(productB)).toBeVisible();

      // ── ACT: hacer el pedido ──────────────────────────────────────────────
      const orderSummary = await marketPage.basket.placeOrder();

      await marketPage.basket.closeOrderModalAndGoToOrders();
      await marketPage.orders.waitForOrdersToLoad();

      // ── ASSERT: la orden solo contiene productB ───────────────────────────
      const orderItems = await marketPage.orders.getOrderItems(orderSummary.orderNumber);
      expect(orderItems).toHaveLength(1);
      expect(orderItems[0].name).toContain(productB);
    },
  );

  // ── CLEAR BASKET (negative path) ───────────────────────────────────────────

  test('CLEAR: clearing basket prevents checkout and shows empty state',
    async ({ marketPage }) => {

      // ── ARRANGE ──────────────────────────────────────────────────────────
      const productName = await marketPage.getProductNameAtIndex(0);
      await marketPage.addProductToBasket(productName);

      // ── ACT: limpiar el basket ────────────────────────────────────────────
      await marketPage.basket.goToBasketTab();
      await expect(marketPage.basket.basketItems).toHaveCount(1);

      await marketPage.basket.clearBasket();

      // ── ASSERT: basket vacío, checkout no disponible ──────────────────────
      await expect(marketPage.basket.emptyState).toBeVisible();
      await expect(marketPage.basket.basketItems).toHaveCount(0);
      await expect(marketPage.basket.placeOrderBtn).not.toBeVisible();
      await expect(marketPage.basket.checkoutCard).not.toBeVisible();
    },
  );

});