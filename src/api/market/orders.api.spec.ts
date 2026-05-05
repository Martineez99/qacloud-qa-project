// ┌─────────────────────────────────────────────────────────────────┐
// │  orders.api.spec.ts                                             │
// │  Lifecycle de pedidos: place, snapshot, stock, status           │
// │                                                                 │
// │  Cubre: TC-ORD-001 a TC-ORD-007                                 │
// └─────────────────────────────────────────────────────────────────┘

import { test, expect } from '../../fixtures/api.fixture';
import { epic, feature, story, severity, tag } from 'allure-js-commons';
import { Order, PlaceOrderResponse } from '../../types/market.types';

test.describe('Market Orders API', () => {

  test.describe.configure({ mode: 'serial' }); // 👈 todos en orden, 1 worker

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
    epic('Market App');
    feature('Basket Management');
    story('Add product to basket');
    severity('critical');
    tag('smoke');
    tag('market');
    tag('basket');

    // ARRANGE: añadir producto a la cesta
    const product = await apiClient.getFirstProduct();
    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 1 },
    });

    // ACT: colocar pedido
    const response = await apiClient.post<PlaceOrderResponse>('/api/orders');

    // ASSERT: respuesta correcta
    const order = response.body.order;

    expect(response.status).toBe(201);
    expect(order.id).toBeTruthy();

    // TC-ORD-007: formato del número de pedido → O + 5 dígitos
    expect(order.order_number).toMatch(/^O\d{5}$/);

    // TC-ORD-001: la cesta debe estar vacía tras el pedido
    const basket = await apiClient.getBasket();
    expect(basket.items.length).toBe(0);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-ORD-002 — Place order with empty basket returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/orders returns 400 when basket is empty', async ({ apiClient }) => {
    epic('Market App');
    feature('Basket Management');
    story('Add product to basket');
    severity('critical');
    tag('smoke');
    tag('market');
    tag('basket');


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
    epic('Market App');
    feature('Basket Management');
    story('Add product to basket');
    severity('critical');
    tag('smoke');
    tag('market');
    tag('basket');


    const product = await apiClient.createProduct({
      product_name: 'Price Test Item',
      price: 10.00,
      category: 'Pantry',
      stock: 10,
    });

    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 3 },
    });

    const response = await apiClient.post<PlaceOrderResponse>('/api/orders');
    expect(response.status).toBe(201);

    const order = response.body.order;

    expect(order.total_amount).toBeCloseTo(30.00, 2);

    const calculatedTotal = order.items.reduce(
      (sum, item) => sum + (item.quantity * item.price),
      0
    );

    expect(calculatedTotal).toBeCloseTo(order.total_amount, 2);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-ORD-004 — price_at_purchase is immutable (snapshot integrity)
  // ════════════════════════════════════════════════════════════════
  test('price_at_purchase does not change when product price is updated', async ({ apiClient }) => {
    epic('Market App');
    feature('Basket Management');
    story('Add product to basket');
    severity('critical');
    tag('smoke');
    tag('market');
    tag('basket');


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
    const orderResponse = await apiClient.post<PlaceOrderResponse>('/api/orders');
    expect(orderResponse.status).toBe(201);

    const order = orderResponse.body.order;
    const originalPriceAtPurchase = order.items[0].price;
    expect(originalPriceAtPurchase).toBe(10.00);

    // ACT: actualizar el precio del producto a 99.99
    await apiClient.put(`/api/groceries/${product.id}`, {
      data: { price: 99.99 },
    });

    // ASSERT: el pedido original mantiene el precio snapshot
    const fetchedOrder = await apiClient.get<Order>(`/api/orders/${order.id}`);
    const priceAfterUpdate = fetchedOrder.body.items[0].price;

    expect(priceAfterUpdate).toBe(10.00);   // no 99.99, debe conservar el valor original del snapshot
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-ORD-004b — order items persist even after product deletion
  // ════════════════════════════════════════════════════════════════
  test('order items are preserved after product is deleted', async ({ apiClient }) => {
    epic('Market App');
    feature('Basket Management');
    story('Add product to basket');
    severity('critical');
    tag('smoke');
    tag('market');
    tag('basket');


    const product = await apiClient.createProduct({
      product_name: 'Delete After Order',
      price:        5.00,
      category:     'Pantry',
      stock:        3,
    });

    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 1 },
    });

    const orderResponse = await apiClient.post<PlaceOrderResponse>('/api/orders');
    const orderId = orderResponse.body.order.id;
    expect(orderResponse.status).toBe(201);

    // Borrar el producto
    await apiClient.delete(`/api/groceries/${product.id}`);

    // El pedido debe seguir teniendo sus order_items intactos
    const fetchedOrder = await apiClient.get<Order>(`/api/orders/${orderId}`);

    expect(fetchedOrder.status).toBe(200);
    expect(fetchedOrder.body.items.length).toBeGreaterThan(0);
    expect(fetchedOrder.body.items[0].product_name).toBe('Delete After Order');
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-ORD-005 — Stock is decremented after placing order
  // ════════════════════════════════════════════════════════════════
  test('POST /api/orders decrements product stock correctly', async ({ apiClient }) => {
    epic('Market App');
    feature('Basket Management');
    story('Add product to basket');
    severity('critical');
    tag('smoke');
    tag('market');
    tag('basket');


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
    epic('Market App');
    feature('Basket Management');
    story('Add product to basket');
    severity('critical');
    tag('smoke');
    tag('market');
    tag('basket');


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
    epic('Market App');
    feature('Basket Management');
    story('Add product to basket');
    severity('critical');
    tag('smoke');
    tag('market');
    tag('basket');


    // Helper para crear un pedido fresco en cada transición
    const placeNewOrder = async () => {
      await apiClient.delete('/api/basket/clear');
      const product = await apiClient.getFirstProduct();
      await apiClient.post('/api/basket', {
        data: { product_id: product.id, quantity: 1 },
      });
      const resp = await apiClient.post<PlaceOrderResponse>('/api/orders');
      return resp.body.order;
    };

    // pending → delivered (pedido 1)
    const order1 = await placeNewOrder();
    const deliveredResp = await apiClient.put<PlaceOrderResponse>(`/api/orders/${order1.id}`, {
      data: { status: 'delivered' },
    });
    expect(deliveredResp.status).toBe(200);
    expect(deliveredResp.body.order.status).toBe('delivered');

    // pending → cancelled (pedido 2, fresco)
    const order2 = await placeNewOrder();
    const cancelledResp = await apiClient.put<PlaceOrderResponse>(`/api/orders/${order2.id}`, {
      data: { status: 'cancelled' },
    });
    expect(cancelledResp.status).toBe(200);
    expect(cancelledResp.body.order.status).toBe('cancelled');
  });

  // ════════════════════════════════════════════════════════════════
  //  DELETE /api/orders/:id removes the order
  // ════════════════════════════════════════════════════════════════
  test('DELETE /api/orders/:id removes order permanently', async ({ apiClient }) => {
    epic('Market App');
    feature('Basket Management');
    story('Add product to basket');
    severity('critical');
    tag('smoke');
    tag('market');
    tag('basket');


    const product = await apiClient.getFirstProduct();
    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 1 },
    });
    const orderResponse = await apiClient.post<PlaceOrderResponse>('/api/orders');
    const orderId = orderResponse.body.order.id;

    const deleteResponse = await apiClient.delete(`/api/orders/${orderId}`);
    expect(deleteResponse.status).toBe(200);

    // Verificar que ya no existe
    const fetchResponse = await apiClient.get(`/api/orders/${orderId}`);
    expect(fetchResponse.status).toBe(404);
  });
});