// ┌─────────────────────────────────────────────────────────────────┐
// │  market.contract.spec.ts                                        │
// │  Contract tests — validan la FORMA de las respuestas de Market  │
// │                                                                 │
// │  ¿Por qué contract tests separados de los funcionales?          │
// │  Los tests funcionales validan COMPORTAMIENTO (status codes,    │
// │  lógica de negocio, edge cases).                                │
// │  Los contract tests validan ESTRUCTURA (tipos, campos           │
// │  requeridos, formatos, enums).                                  │
// │                                                                 │
// │  Si el backend cambia la forma de una respuesta sin avisar      │
// │  (ej: renombra 'order_number' a 'orderNumber'), estos tests     │
// │  fallan inmediatamente — independientemente de si la lógica     │
// │  sigue funcionando.                                             │
// │                                                                 │
// │  Tags: @contract @market @api                                   │
// └─────────────────────────────────────────────────────────────────┘

import { test, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';
import { validateSchema } from './schema-validator';
import {
  productSchema,
  productsListSchema,
  basketItemSchema,
  basketResponseSchema,
  orderItemSchema,
  orderSchema,
  placeOrderResponseSchema,
  resetResponseSchema,
  updateOrderResponseSchema,
} from './market.schema';

// ─────────────────────────────────────────────────────────────────────────────
//  Configuración de entorno
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL    = process.env.QACLOUD_BASE_URL as string;
const API_KEY     = process.env.QACLOUD_API_KEY  as string;
const authHeaders = { Authorization: API_KEY };

// ─────────────────────────────────────────────────────────────────────────────
//  Suite
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Market API — Contract Tests (JSON Schema)', () => {

  test.describe.configure({ mode: 'serial' }); // 👈 orden predecible, 1 worker

  // Estado determinista antes de toda la suite.
  // El reset solo afecta al catálogo de productos, no a basket ni orders.
  // La cesta se limpia manualmente.
  test.beforeAll(async ({ request }) => {
    await request.post(`${BASE_URL}/api/reset`, { headers: authHeaders });
    await request.delete(`${BASE_URL}/api/basket/clear`, { headers: authHeaders });
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  RESET ENDPOINT
  //  Validamos la forma de la respuesta del endpoint de utilidad
  // ══════════════════════════════════════════════════════════════════════════
  test('POST /api/reset matches resetResponseSchema', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Contract Testing');
    await allure.story('Reset endpoint response contract');
    await allure.severity('normal');
    await allure.tag('contract');
    await allure.tag('market');
    await allure.tag('reset');

    const res  = await request.post(`${BASE_URL}/api/reset`, { headers: authHeaders });
    const body = await res.json();

    expect(res.status()).toBe(200);

    // La API devuelve { message, products[] } — NO devuelve 'count' (ver market.schema.ts)
    validateSchema(resetResponseSchema, body, 'POST /api/reset');

    // Verificación de negocio: el seed devuelve al menos 25 productos,
    // y cada uno debe cumplir el productSchema individualmente
    expect(body.products.length).toBeGreaterThanOrEqual(25);
    for (const product of body.products) {
      validateSchema(productSchema, product, `ResetProduct[${product.id ?? 'unknown'}]`);
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  PRODUCTS
  // ══════════════════════════════════════════════════════════════════════════

  test('GET /api/groceries matches productsListSchema', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Contract Testing');
    await allure.story('Products list response contract');
    await allure.severity('critical');
    await allure.tag('contract');
    await allure.tag('market');
    await allure.tag('products');

    const res  = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
    const body = await res.json();

    expect(res.status()).toBe(200);

    // 1. La respuesta completa cumple el schema de la lista
    validateSchema(productsListSchema, body, 'GET /api/groceries');

    // 2. Cada producto individual también cumple su propio schema.
    //    Esto detecta si solo UNO de los 25-30 productos tiene un campo roto.
    for (const product of body.products) {
      validateSchema(productSchema, product, `Product[${product.id ?? 'unknown'}]`);
    }
  });

  test('POST /api/groceries (all fields) matches productSchema', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Contract Testing');
    await allure.story('Create product response contract');
    await allure.severity('critical');
    await allure.tag('contract');
    await allure.tag('market');
    await allure.tag('products');

    // Enviamos todos los campos opcionales para verificar que el schema
    // acepta temperature_zone, weighted y details correctamente
    const res = await request.post(`${BASE_URL}/api/groceries`, {
      headers: authHeaders,
      data: {
        product_name:     'Contract Test Cheese',
        price:            4.99,
        category:         'Dairy',
        temperature_zone: 'Chilled',
        weighted:         false,
        stock:            10,
        details:          { brand: 'QA Brand', weight: '400g' },
      },
    });
    const body = await res.json();

    expect(res.status()).toBe(201);
    validateSchema(productSchema, body, 'POST /api/groceries (all fields)');
  });

  test('POST /api/groceries (required fields only) matches productSchema', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Contract Testing');
    await allure.story('Create minimal product response contract');
    await allure.severity('normal');
    await allure.tag('contract');
    await allure.tag('market');
    await allure.tag('products');

    // Validamos que la respuesta con campos mínimos también cumple el schema.
    // Los campos opcionales ausentes no deben romper la estructura.
    const res = await request.post(`${BASE_URL}/api/groceries`, {
      headers: authHeaders,
      data: {
        product_name: 'Contract Minimal Product',
        price:        1.99,
        category:     'Pantry',
      },
    });
    const body = await res.json();

    expect(res.status()).toBe(201);
    validateSchema(productSchema, body, 'POST /api/groceries (required only)');
  });

  test('PUT /api/groceries/:id matches productSchema', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Contract Testing');
    await allure.story('Update product response contract');
    await allure.severity('normal');
    await allure.tag('contract');
    await allure.tag('market');
    await allure.tag('products');

    // Obtenemos el ID del primer producto del catálogo seed
    const listRes  = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
    const listBody = await listRes.json();
    const product  = listBody.products[0];

    const res  = await request.put(`${BASE_URL}/api/groceries/${product.id}`, {
      headers: authHeaders,
      data: { price: 9.99 },   // partial update — solo el precio
    });
    const body = await res.json();

    expect(res.status()).toBe(200);
    validateSchema(productSchema, body, `PUT /api/groceries/${product.id}`);

    // El resto de campos no deben haber cambiado su tipo
    expect(body.product_name).toBe(product.product_name);
    expect(typeof body.stock).toBe('number');
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  BASKET
  // ══════════════════════════════════════════════════════════════════════════

  test('GET /api/basket (empty) matches basketResponseSchema', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Contract Testing');
    await allure.story('Empty basket response contract');
    await allure.severity('normal');
    await allure.tag('contract');
    await allure.tag('market');
    await allure.tag('basket');

    // La cesta está vacía por el beforeAll
    const res  = await request.get(`${BASE_URL}/api/basket`, { headers: authHeaders });
    const body = await res.json();

    expect(res.status()).toBe(200);
    validateSchema(basketResponseSchema, body, 'GET /api/basket (empty)');

    // Aunque esté vacía, debe ser un array (no null ni undefined)
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(0);
  });

  test('GET /api/basket (with items) matches basketResponseSchema', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Contract Testing');
    await allure.story('Basket with items response contract');
    await allure.severity('critical');
    await allure.tag('contract');
    await allure.tag('market');
    await allure.tag('basket');

    // ARRANGE: añadir un producto a la cesta
    const listRes  = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
    const listBody = await listRes.json();
    const product  = listBody.products.find((p: any) => p.stock >= 1);

    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 1 },
    });

    // ACT
    const res  = await request.get(`${BASE_URL}/api/basket`, { headers: authHeaders });
    const body = await res.json();

    // ASSERT — schema de la respuesta completa
    expect(res.status()).toBe(200);
    validateSchema(basketResponseSchema, body, 'GET /api/basket (with items)');

    // Cada ítem individual también debe cumplir el schema
    for (const item of body.items) {
      validateSchema(basketItemSchema, item, `BasketItem[${item.product_id}]`);
    }

    // TEARDOWN: limpiar la cesta para no afectar al siguiente test
    await request.delete(`${BASE_URL}/api/basket/clear`, { headers: authHeaders });
  });

  // ══════════════════════════════════════════════════════════════════════════
  //  ORDERS
  // ══════════════════════════════════════════════════════════════════════════

  test('POST /api/orders matches placeOrderResponseSchema', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Contract Testing');
    await allure.story('Place order response contract');
    await allure.severity('critical');
    await allure.tag('contract');
    await allure.tag('market');
    await allure.tag('orders');

    // ARRANGE: añadir producto a la cesta
    const listRes  = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
    const listBody = await listRes.json();
    const product  = listBody.products.find((p: any) => p.stock >= 1);

    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 1 },
    });

    // ACT
    const res  = await request.post(`${BASE_URL}/api/orders`, { headers: authHeaders });
    const body = await res.json();

    // ASSERT — schema de la respuesta wrapper
    expect(res.status()).toBe(201);
    validateSchema(placeOrderResponseSchema, body, 'POST /api/orders');

    // Validamos también los subschemas anidados
    validateSchema(orderSchema, body.order, 'Order object (POST /api/orders)');
    for (const item of body.order.items) {
      validateSchema(orderItemSchema, item, `OrderItem[${item.product_name}]`);
    }
  });

  test('GET /api/orders/:id matches orderSchema', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Contract Testing');
    await allure.story('Get single order response contract');
    await allure.severity('critical');
    await allure.tag('contract');
    await allure.tag('market');
    await allure.tag('orders');

    // ARRANGE: necesitamos un pedido existente para hacer GET por ID
    const listRes  = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
    const listBody = await listRes.json();
    const product  = listBody.products.find((p: any) => p.stock >= 1);

    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 1 },
    });

    const orderRes  = await request.post(`${BASE_URL}/api/orders`, { headers: authHeaders });
    const orderBody = await orderRes.json();
    const orderId   = orderBody.order.id;

    // ACT — GET del pedido específico
    const res  = await request.get(`${BASE_URL}/api/orders/${orderId}`, { headers: authHeaders });
    const body = await res.json();

    // GET /api/orders/:id devuelve el objeto Order directamente (no envuelto en { order: ... })
    expect(res.status()).toBe(200);
    validateSchema(orderSchema, body, `GET /api/orders/${orderId}`);

    // Verificamos también los order items
    for (const item of body.items) {
      validateSchema(orderItemSchema, item, `OrderItem[${item.product_name}]`);
    }
  });

  test('PUT /api/orders/:id (status update) matches updateOrderResponseSchema', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Contract Testing');
    await allure.story('Update order response contract');
    await allure.severity('normal');
    await allure.tag('contract');
    await allure.tag('market');
    await allure.tag('orders');

    // ARRANGE: crear pedido para actualizar
    const listRes  = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
    const listBody = await listRes.json();
    const product  = listBody.products.find((p: any) => p.stock >= 1);

    await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 1 },
    });

    const orderRes  = await request.post(`${BASE_URL}/api/orders`, { headers: authHeaders });
    const orderBody = await orderRes.json();
    const orderId   = orderBody.order.id;

    // ACT — actualizar el status
    const res  = await request.put(`${BASE_URL}/api/orders/${orderId}`, {
      headers: authHeaders,
      data: { status: 'delivered' },
    });
    const body = await res.json();

    expect(res.status()).toBe(200);

    // PUT devuelve { message, order } SIN items — schema específico para este endpoint
    validateSchema(updateOrderResponseSchema, body, `PUT /api/orders/${orderId}`);

    // El status debe haber cambiado al valor enviado
    expect(body.order.status).toBe('delivered');

  });
});