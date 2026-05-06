import { test, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';

// ─────────────────────────────────────────────────────────────────
//  Helpers locales
// ─────────────────────────────────────────────────────────────────
const BASE_URL = process.env.QACLOUD_BASE_URL as string;
const API_KEY  = process.env.QACLOUD_API_KEY  as string;

const authHeaders = { Authorization: API_KEY };

/**
 * Devuelve el primer producto del catálogo que cumpla el criterio de stock mínimo.
 * Lanza si no encuentra ninguno (el catálogo seed siempre tiene stock, es un guard).
 */
async function getProductWithStock(request: any, minStock = 1) {
  const res  = await request.get(`${BASE_URL}/api/groceries`, { headers: authHeaders });
  const body = await res.json();
  const prod = body.products.find((p: any) => p.stock >= minStock);
  if (!prod) throw new Error(`No product found with stock >= ${minStock}`);
  return prod;
}

// ─────────────────────────────────────────────────────────────────
//  Suite
// ─────────────────────────────────────────────────────────────────
test.describe('Basket API — Edge Cases & Stock Validation', () => {
  test.describe.configure({ mode: 'serial' }); // 👈 todos en orden, 1 worker
    
  test.beforeEach(async ({ request }) => {
    // Estado determinista: reset del catálogo antes de cada test
    // ⚠️ El reset NO afecta Basket ni Orders — se limpia manualmente
    await request.post(`${BASE_URL}/api/reset`, { headers: authHeaders });
    await request.delete(`${BASE_URL}/api/basket/clear`, { headers: authHeaders });
  });

  // ── TC-BASK-002 ───────────────────────────────────────────────
  test('TC-BASK-002 | adding same product twice merges quantities', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Basket accumulation / merge logic');
    await allure.severity('normal');
    await allure.tag('basket', 'edge-case', 'merge');

    // ARRANGE
    const product = await getProductWithStock(request, 5);

    // ACT — primera adición
    const firstAdd = await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 2 },
    });
    expect(firstAdd.status()).toBe(201);

    // ACT — segunda adición del mismo producto
    const secondAdd = await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 3 },
    });
    expect(secondAdd.status()).toBe(200); // 200 OK porque se actualiza, no se crea nuevo

    // ASSERT — solo una fila, cantidad fusionada
    const basketRes  = await request.get(`${BASE_URL}/api/basket`, { headers: authHeaders });
    const basketBody = await basketRes.json();

    const items = basketBody.items ?? basketBody;
    const rows  = items.filter((i: any) => i.product_id === product.id);

    expect(rows).toHaveLength(1);
    expect(rows[0].quantity).toBe(5);
  });

  // ── TC-BASK-003 ───────────────────────────────────────────────
  test('TC-BASK-003 | adding quantity greater than available stock returns 400', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Stock validation');
    await allure.severity('critical');
    await allure.tag('basket', 'edge-case', 'stock', 'negative');

    // ARRANGE — necesitamos un producto con stock conocido y bajo
    // Creamos uno con stock=5 para controlar el escenario exactamente
    const createRes = await request.post(`${BASE_URL}/api/groceries`, {
      headers: authHeaders,
      data: {
        product_name: 'Edge Case Cheese',
        price: 3.99,
        category: 'Dairy',
        stock: 5,
      },
    });
    expect(createRes.status()).toBe(201);
    const product = await createRes.json();

    // ACT — intentar añadir stock+1 unidades
    const res  = await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 6 },
    });
    const body = await res.json();

    // ASSERT
    expect(res.status()).toBe(400);
    expect(body.message ?? body.error).toMatch(/Not enough stock/i);
    expect(body.message ?? body.error).toContain('5'); // menciona el stock disponible
  });

  // ── TC-BASK-004 ───────────────────────────────────────────────
  test('TC-BASK-004 | stock check accounts for quantity already in basket', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Stock validation with existing basket items');
    await allure.severity('critical');
    await allure.tag('basket', 'edge-case', 'stock', 'negative');

    // ARRANGE — producto con stock=5
    const createRes = await request.post(`${BASE_URL}/api/groceries`, {
      headers: authHeaders,
      data: {
        product_name: 'Stock Tracker Milk',
        price: 1.99,
        category: 'Dairy',
        stock: 5,
      },
    });
    const product = await createRes.json();

    // Añadir 3 unidades primero (válido)
    const firstAdd = await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 3 },
    });
    expect(firstAdd.status()).toBe(201);

    // ACT — intentar añadir 3 más (total sería 6, stock es 5)
    const res  = await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 3 },
    });
    const body = await res.json();

    // ASSERT — error que menciona "Already in basket"
    expect(res.status()).toBe(400);
    const errorMsg = body.message ?? body.error ?? '';
    expect(errorMsg).toMatch(/Already in basket/i);
    expect(errorMsg).toContain('3'); // cantidad ya en cesta
  });

  // ── TC-BASK-005 ───────────────────────────────────────────────
  test('TC-BASK-005 | adding item with quantity 0 returns 400', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Quantity boundary validation');
    await allure.severity('normal');
    await allure.tag('basket', 'edge-case', 'negative', 'validation');

    // ARRANGE
    const product = await getProductWithStock(request, 1);

    // ACT
    const res  = await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 0 },
    });
    const body = await res.json();
    console.log('Response body:', body); // debug
    // ASSERT
    expect(res.status()).toBe(400);
    expect(body.message ?? body.error).toMatch(/product_id and quantity are required/i);
  });

  // ── TC-BASK-005b — variante con negativo ──────────────────────
  test('TC-BASK-005b | adding item with negative quantity returns 400', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Quantity boundary validation');
    await allure.severity('normal');
    await allure.tag('basket', 'edge-case', 'negative', 'validation');

    const product = await getProductWithStock(request, 1);

    const res  = await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: -1 },
    });

    expect(res.status()).toBe(400);
  });

  // ── TC-BASK-006 ───────────────────────────────────────────────
  test('TC-BASK-006 | deleting a product cascades and removes it from basket', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Cascade delete: product → basket');
    await allure.severity('critical');
    await allure.tag('basket', 'edge-case', 'cascade');

    // ARRANGE — producto custom para controlar el ciclo de vida completo
    const createRes = await request.post(`${BASE_URL}/api/groceries`, {
      headers: authHeaders,
      data: {
        product_name: 'Cascade Test Bread',
        price: 2.50,
        category: 'Bakery',
        stock: 10,
      },
    });
    const product = await createRes.json();

    // Añadir a la cesta
    const addRes = await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 2 },
    });
    expect(addRes.status()).toBe(201);

    // Verificar que está en la cesta antes de borrar
    const beforeBasket = await request.get(`${BASE_URL}/api/basket`, { headers: authHeaders });
    const beforeBody   = await beforeBasket.json();
    const itemsBefore  = beforeBody.items ?? beforeBody;
    expect(itemsBefore.some((i: any) => i.product_id === product.id)).toBe(true);

    // ACT — borrar el producto
    const deleteRes = await request.delete(`${BASE_URL}/api/groceries/${product.id}`, {
      headers: authHeaders,
    });
    expect(deleteRes.status()).toBe(200);

    // ASSERT — el producto ya no está en la cesta
    const afterBasket = await request.get(`${BASE_URL}/api/basket`, { headers: authHeaders });
    const afterBody   = await afterBasket.json();
    const itemsAfter  = afterBody.items ?? afterBody;
    expect(itemsAfter.some((i: any) => i.product_id === product.id)).toBe(false);
  });

  // ── EXTRA: Exact stock boundary (positivo) ────────────────────
  test('EXTRA | adding exactly the available stock quantity succeeds', async ({ request }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Stock boundary — exact limit accepted');
    await allure.severity('normal');
    await allure.tag('basket', 'edge-case', 'boundary', 'positive');

    // ARRANGE — producto con stock=3
    const createRes = await request.post(`${BASE_URL}/api/groceries`, {
      headers: authHeaders,
      data: {
        product_name: 'Boundary Yogurt',
        price: 1.50,
        category: 'Dairy',
        stock: 3,
      },
    });
    const product = await createRes.json();

    // ACT — añadir exactamente el stock disponible
    const res = await request.post(`${BASE_URL}/api/basket`, {
      headers: authHeaders,
      data: { product_id: product.id, quantity: 3 },
    });

    // ASSERT
    expect(res.status()).toBe(201);
  });
});