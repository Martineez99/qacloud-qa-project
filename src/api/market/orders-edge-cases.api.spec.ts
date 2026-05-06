import { test, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';

const BASE_URL = process.env.QACLOUD_BASE_URL as string;
const API_KEY  = process.env.QACLOUD_API_KEY  as string;

const authHeaders = { Authorization: API_KEY };

test.describe('Orders API — Edge Cases', () => {
  test.describe.configure({ mode: 'serial' }); // 👈 todos en orden, 1 worker
  
  test.beforeEach(async ({ request }) => {
    await request.post(`${BASE_URL}/api/reset`, { headers: authHeaders });
    await request.delete(`${BASE_URL}/api/basket/clear`, { headers: authHeaders });
  });

  // ── TC-ORD-002 ────────────────────────────────────────────────
  test('TC-ORD-002 | placing order with empty basket returns 400', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Empty basket order prevention');
    await allure.severity('critical');
    await allure.tag('orders', 'edge-case', 'negative');

    // ARRANGE — beforeEach ya garantiza la cesta vacía

    // ACT
    const res  = await request.post(`${BASE_URL}/api/orders`, { headers: authHeaders });
    const body = await res.json();

    // ASSERT
    expect(res.status()).toBe(400);
    expect(body.message ?? body.error).toMatch(/basket is empty/i);
  });

  // ── TC-ORD-002b — empty basket tras CLEAR ────────────────────
  test('TC-ORD-002b | placing order after clearing basket returns 400', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Empty basket order prevention after clear');
    await allure.severity('normal');
    await allure.tag('orders', 'edge-case', 'negative');

    // ARRANGE — añadir, luego limpiar
    const listRes = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
    const listBody = await listRes.json();
    const product  = listBody.products.find((p: any) => p.stock >= 1);

    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 1 },
    });
    await request.delete(`${BASE_URL}/api/basket/clear`, { headers: authHeaders });

    // ACT
    const res = await request.post(`${BASE_URL}/api/orders`, { headers: authHeaders });

    // ASSERT
    expect(res.status()).toBe(400);
  });

  // ── TC-ORD-003 ────────────────────────────────────────────────
  test('TC-ORD-003 | order total matches sum of basket items', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Order total calculation accuracy');
    await allure.severity('critical');
    await allure.tag('orders', 'edge-case', 'data-integrity');

    // ARRANGE — crear productos con precios conocidos
    const p1Res = await request.post(`${BASE_URL}/api/groceries`, {
      headers: authHeaders,
      data: { product_name: 'Price Test Apple', price: 2.00, category: 'Produce', stock: 10 },
    });
    const p2Res = await request.post(`${BASE_URL}/api/groceries`, {
      headers: authHeaders,
      data: { product_name: 'Price Test Bread', price: 3.50, category: 'Bakery', stock: 10 },
    });
    const p1 = await p1Res.json();
    const p2 = await p2Res.json();

    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: p1.id, quantity: 3 }, // 3 × 2.00 = 6.00
    });
    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: p2.id, quantity: 2 }, // 2 × 3.50 = 7.00
    });

    // Total esperado: 13.00
    const expectedTotal = (2.00 * 3) + (3.50 * 2);

    // ACT
    const orderRes  = await request.post(`${BASE_URL}/api/orders`, { headers: authHeaders });
    const orderBody = await orderRes.json();

    // ASSERT
    expect(orderRes.status()).toBe(201);
    expect(parseFloat(orderBody.order.total_amount)).toBeCloseTo(expectedTotal, 2);
  });

  // ── TC-ORD-004 ────────────────────────────────────────────────
  test('TC-ORD-004 | price_at_purchase is immutable after product price update', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Price snapshot integrity');
    await allure.severity('critical');
    await allure.tag('orders', 'edge-case', 'data-integrity', 'price-snapshot');

    // ARRANGE
    const createRes = await request.post(`${BASE_URL}/api/groceries`, {
      headers: authHeaders,
      data: { product_name: 'Snapshot Cheese', price: 10.00, category: 'Dairy', stock: 5 },
    });
    const product = await createRes.json();

    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 1 },
    });

    const orderRes  = await request.post(`${BASE_URL}/api/orders`, { headers: authHeaders });
    const orderBody = await orderRes.json();
    const orderId   = orderBody.order.id;

    // Capturar price_at_purchase original
    const originalPrice = orderBody.order.items
    ? orderBody.order.items.find(
        (i: any) => i.product_name === product.product_name
        )?.price
    : orderBody.order_items?.find(
        (i: any) => i.product_name === product.product_name
        )?.price;

    expect(originalPrice).toBe(10.00);

    // ACT — actualizar el precio del producto
    await request.put(`${BASE_URL}/api/groceries/${product.id}`, {
      headers: authHeaders,
      data: { price: 99.99 },
    });

    // ASSERT — el pedido sigue teniendo el precio original
    const fetchedOrder = await request.get(`${BASE_URL}/api/orders/${orderId}`, {
      headers: authHeaders,
    });
    const fetchedBody = await fetchedOrder.json();
    const priceAfterUpdate = fetchedBody.items
    ? fetchedBody.items.find(
        (i: any) => i.product_name === product.product_name
        )?.price
    : fetchedBody.items?.find(
        (i: any) => i.product_name === product.product_name
        )?.price;

    expect(priceAfterUpdate).toBe(10.00);
    expect(priceAfterUpdate).not.toBe(99.99);
  });

  // ── TC-ORD-005 ────────────────────────────────────────────────
  test('TC-ORD-005 | placing order decrements product stock', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Stock decrement after order placement');
    await allure.severity('critical');
    await allure.tag('orders', 'edge-case', 'stock');

    // ARRANGE
    const createRes = await request.post(`${BASE_URL}/api/groceries`, {
      headers: authHeaders,
      data: { product_name: 'Stock Decrement Ham', price: 5.00, category: 'Deli', stock: 10 },
    });
    const product = await createRes.json();

    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 3 },
    });

    // ACT
    const orderRes = await request.post(`${BASE_URL}/api/orders`, { headers: authHeaders });
    expect(orderRes.status()).toBe(201);

    // ASSERT — stock debe ser 10 - 3 = 7
    const productRes  = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
    const productBody = await productRes.json();
    const updated     = productBody.products.find((p: any) => p.id === product.id);

    expect(updated.stock).toBe(7);
  });

  // ── TC-ORD-006 ────────────────────────────────────────────────
  test('TC-ORD-006 | updating order with invalid status returns 400', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Order status validation');
    await allure.severity('normal');
    await allure.tag('orders', 'edge-case', 'negative', 'validation');

    // ARRANGE — colocar un pedido
    const listRes  = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
    const listBody = await listRes.json();
    const product  = listBody.products.find((p: any) => p.stock >= 1);

    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 1 },
    });

    const orderRes  = await request.post(`${BASE_URL}/api/orders`, { headers: authHeaders });
    const orderBody = await orderRes.json();

    // ACT — status inválido
    const updateRes = await request.put(`${BASE_URL}/api/orders/${orderBody.id}`, {
      headers: authHeaders,
      data: { status: 'returned' }, // no existe en la lista de válidos
    });

    // ASSERT
    expect(updateRes.status()).toBe(400);
  });

  // ── TC-ORD-007 ────────────────────────────────────────────────
  test('TC-ORD-007 | order number matches format O#####', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Order number format validation');
    await allure.severity('minor');
    await allure.tag('orders', 'edge-case', 'format');

    // ARRANGE
    const listRes  = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
    const listBody = await listRes.json();
    const product  = listBody.products.find((p: any) => p.stock >= 1);

    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 1 },
    });

    // ACT
    const orderRes  = await request.post(`${BASE_URL}/api/orders`, { headers: authHeaders });
    const orderBody = await orderRes.json();
    console.log('Order response body:', orderBody); // Depuración para verificar estructura
    // ASSERT
    expect(orderBody.order.order_number).toMatch(/^O\d{5}$/);
  });

  // ── EXTRA: basket se vacía tras el pedido ────────────────────
  test('EXTRA | basket is automatically cleared after placing order', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Order Management');
    await allure.story('Basket cleared after successful order');
    await allure.severity('critical');
    await allure.tag('orders', 'edge-case', 'basket', 'side-effect');

    // ARRANGE
    const listRes  = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
    const listBody = await listRes.json();
    const product  = listBody.products.find((p: any) => p.stock >= 2);

    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 2 },
    });

    // ACT
    await request.post(`${BASE_URL}/api/orders`, { headers: authHeaders });

    // ASSERT
    const basketRes  = await request.get(`${BASE_URL}/api/basket`, { headers: authHeaders });
    const basketBody = await basketRes.json();
    const items      = basketBody.items ?? basketBody;

    expect(items).toHaveLength(0);
  });
});