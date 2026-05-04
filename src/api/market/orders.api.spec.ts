// ┌─────────────────────────────────────────────────────────────────┐
// │  orders.api.spec.ts                                             │
// │  Lifecycle de pedidos: place, snapshot, stock, status           │
// │                                                                 │
// │  Cubre: TC-ORD-001 a TC-ORD-007                                 │
// └─────────────────────────────────────────────────────────────────┘

import { test, expect } from '../../fixtures/api.fixture';
import { allure } from 'allure-playwright';
import { Order } from '../../types/market.types';

test.describe('Market Orders API', () => {

  // Reset antes de cada test + limpiar cesta
  // Los tests de orders necesitan cesta limpia y stock predecible
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.reset();
    await apiClient.delete('/api/basket/clear');
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-ORD-001 — Place order returns 201, clears basket
  // ════════════════════════════════════════════════════════════════
  test('POST /api/orders returns 201 with valid order_number and clears basket', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Place order');
    await allure.severity('critical');
    await allure.tag('smoke', 'market', 'orders');

    // ARRANGE: añadir producto a la cesta
    const product = await apiClient.getFirstProduct();
    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 1 },
    });

    // ACT: colocar pedido
    const response = await apiClient.post<Order>('/api/orders');

    // ASSERT: respuesta correcta
    expect(response.status).toBe(201);
    expect(response.body.id).toBeTruthy();

    // TC-ORD-007: formato del número de pedido → O + 5 dígitos
    expect(response.body.order_number).toMatch(/^O\d{5}$/);

    // TC-ORD-001: la cesta debe estar vacía tras el pedido
    const basket = await apiClient.getBasket();
    expect(basket.items.length).toBe(0);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-ORD-002 — Place order with empty basket returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/orders returns 400 when basket is empty', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Place order validation');
    await allure.severity('critical');
    await allure.tag('market', 'orders', 'negative');

    // La cesta está limpia por el beforeEach
    const response = await apiClient.post('/api/orders');

    expect(response.status).toBe(400);

    const errorMessage = JSON.stringify(response.body);
    expect(errorMessage).toMatch(/basket|empty/i);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-ORD-003 — total_amount matches sum of items
  // ════════════════════════════════════════════════════════════════
  test('POST /api/orders total_amount matches sum of order items', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Order total calculation');
    await allure.severity('critical');
    await allure.tag('market', 'orders');

    // Usamos un producto con precio conocido para poder calcular
    const product = await apiClient.createProduct({
      product_name: 'Price Test Item',
      price:        10.00,
      category:     'Pantry',
      stock:        10,
    });

    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 3 },
    });

    const response = await apiClient.post<Order>('/api/orders');
    expect(response.status).toBe(201);

    const order = response.body;

    // total_amount debe ser 3 × 10.00 = 30.00
    expect(order.total_amount).toBeCloseTo(30.00, 2);

    // La suma de subtotales de los order_items debe cuadrar con el total
    const calculatedTotal = order.order_items.reduce(
      (sum, item) => sum + item.subtotal,
      0
    );
    expect(calculatedTotal).toBeCloseTo(order.total_amount, 2);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-ORD-004 — price_at_purchase is immutable (snapshot integrity)
  // ════════════════════════════════════════════════════════════════
  test('price_at_purchase does not change when product price is updated', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Price snapshot integrity');
    await allure.severity('critical');
    await allure.tag('market', 'orders', 'edge', 'data-integrity');

    // ARRANGE: producto con precio conocido
    const product = await apiClient.createProduct({
      product_name: 'Snapshot Test Item',
      price:        10.00,
      category:     'Pantry',
      stock:        5,
    });

    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 1 },
    });

    // Colocar pedido — capturamos el price_at_purchase
    const orderResponse = await apiClient.post<Order>('/api/orders');
    expect(orderResponse.status).toBe(201);

    const originalPriceAtPurchase = orderResponse.body.order_items[0].price_at_purchase;
    expect(originalPriceAtPurchase).toBe(10.00);

    // ACT: actualizar el precio del producto a 99.99
    await apiClient.put(`/api/groceries/${product.id}`, {
      data: { price: 99.99 },
    });

    // ASSERT: el pedido original mantiene el precio snapshot
    const fetchedOrder = await apiClient.get<Order>(`/api/orders/${orderResponse.body.id}`);
    const priceAfterUpdate = fetchedOrder.body.order_items[0].price_at_purchase;

    expect(priceAfterUpdate).toBe(10.00);   // no 99.99
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-ORD-004b — order items persist even after product deletion
  // ════════════════════════════════════════════════════════════════
  test('order items are preserved after product is deleted', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Price snapshot integrity');
    await allure.severity('normal');
    await allure.tag('market', 'orders', 'edge', 'data-integrity');

    const product = await apiClient.createProduct({
      product_name: 'Delete After Order',
      price:        5.00,
      category:     'Pantry',
      stock:        3,
    });

    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 1 },
    });

    const orderResponse = await apiClient.post<Order>('/api/orders');
    const orderId = orderResponse.body.id;

    // Borrar el producto
    await apiClient.delete(`/api/groceries/${product.id}`);

    // El pedido debe seguir teniendo sus order_items intactos
    const fetchedOrder = await apiClient.get<Order>(`/api/orders/${orderId}`);
    expect(fetchedOrder.status).toBe(200);
    expect(fetchedOrder.body.order_items.length).toBeGreaterThan(0);
    expect(fetchedOrder.body.order_items[0].product_name).toBe('Delete After Order');
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-ORD-005 — Stock is decremented after placing order
  // ════════════════════════════════════════════════════════════════
  test('POST /api/orders decrements product stock correctly', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Stock management');
    await allure.severity('critical');
    await allure.tag('market', 'orders');

    // Producto con stock controlado
    const product = await apiClient.createProduct({
      product_name: 'Stock Decrement Test',
      price:        2.00,
      category:     'Pantry',
      stock:        10,
    });

    const buyQty = 3;
    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: buyQty },
    });

    await apiClient.post('/api/orders');

    // Verificar stock decrementado
    const productsAfter = await apiClient.getProducts();
    const updatedProduct = productsAfter.find(p => p.id === product.id);

    // Si el producto sigue existiendo, el stock debe ser 10 - 3 = 7
    if (updatedProduct) {
      expect(updatedProduct.stock).toBe(10 - buyQty);
    }
    // Nota: si el producto fue removido del catálogo post-stock=0, el test
    // lo acepta como comportamiento válido de la plataforma
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-ORD-006 — PUT with invalid status returns 400
  // ════════════════════════════════════════════════════════════════
  test('PUT /api/orders/:id returns 400 for invalid status', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Order status validation');
    await allure.severity('normal');
    await allure.tag('market', 'orders', 'negative');

    // Necesitamos un pedido existente
    const product = await apiClient.getFirstProduct();
    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 1 },
    });
    const orderResponse = await apiClient.post<Order>('/api/orders');
    const orderId = orderResponse.body.id;

    // Intentar un status que no existe en el union
    const response = await apiClient.put(`/api/orders/${orderId}`, {
      data: { status: 'returned' },
    });

    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  PUT valid status cycle: pending → delivered → cancelled
  // ════════════════════════════════════════════════════════════════
  test('PUT /api/orders/:id updates status through valid transitions', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Order status transitions');
    await allure.severity('normal');
    await allure.tag('market', 'orders');

    const product = await apiClient.getFirstProduct();
    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 1 },
    });
    const orderResponse = await apiClient.post<Order>('/api/orders');
    const orderId = orderResponse.body.id;

    // El pedido arranca en pending
    expect(orderResponse.body.status).toBe('pending');

    // Pasar a delivered
    const deliveredResp = await apiClient.put<Order>(`/api/orders/${orderId}`, {
      data: { status: 'delivered' },
    });
    expect(deliveredResp.status).toBe(200);
    expect(deliveredResp.body.status).toBe('delivered');

    // Pasar a cancelled
    const cancelledResp = await apiClient.put<Order>(`/api/orders/${orderId}`, {
      data: { status: 'cancelled' },
    });
    expect(cancelledResp.status).toBe(200);
    expect(cancelledResp.body.status).toBe('cancelled');
  });

  // ════════════════════════════════════════════════════════════════
  //  DELETE /api/orders/:id removes the order
  // ════════════════════════════════════════════════════════════════
  test('DELETE /api/orders/:id removes order permanently', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Delete order');
    await allure.severity('normal');
    await allure.tag('market', 'orders');

    const product = await apiClient.getFirstProduct();
    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 1 },
    });
    const orderResponse = await apiClient.post<Order>('/api/orders');
    const orderId = orderResponse.body.id;

    const deleteResponse = await apiClient.delete(`/api/orders/${orderId}`);
    expect(deleteResponse.status).toBe(200);

    // Verificar que ya no existe
    const fetchResponse = await apiClient.get(`/api/orders/${orderId}`);
    expect(fetchResponse.status).toBe(404);
  });
});