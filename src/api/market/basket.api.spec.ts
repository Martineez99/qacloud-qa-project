// ┌─────────────────────────────────────────────────────────────────┐
// │  basket.api.spec.ts                                             │
// │  Edge cases de la cesta: merge, stock validation, cascade       │
// │                                                                 │
// │  Cubre: TC-BASK-001 a TC-BASK-006                               │
// └─────────────────────────────────────────────────────────────────┘

import { test, expect } from '../../fixtures/api.fixture';
import { allure } from 'allure-playwright';
import { Basket, Product } from '../../types/market.types';

test.describe('Market Basket API', () => {

  // Reset + cesta limpia antes de cada test.
  // Aquí usamos beforeEach (no beforeAll) porque cada test de basket
  // modifica el estado compartido. Un beforeAll solo no es suficiente:
  // si TC-BASK-002 deja qty=5, TC-BASK-003 parte de un estado sucio.
  test.beforeEach(async ({ apiClient }) => {
    await apiClient.reset();
    // Limpiar la cesta también (reset no la toca)
    await apiClient.delete('/api/basket/clear');
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-BASK-001 — Add product to basket returns 201
  // ════════════════════════════════════════════════════════════════
  test('POST /api/basket adds product and returns 201', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Add product to basket');
    await allure.severity('critical');
    await allure.tag('smoke', 'market', 'basket');

    const product = await apiClient.getFirstProduct();

    const response = await apiClient.post<Basket>('/api/basket', {
      data: { product_id: product.id, quantity: 2 },
    });

    expect(response.status).toBe(201);

    // Verificamos que el ítem está en la cesta con la cantidad correcta
    const basket = await apiClient.getBasket();
    const item = basket.items.find(i => i.product_id === product.id);

    expect(item).toBeDefined();
    expect(item!.quantity).toBe(2);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-BASK-002 — Adding same product twice MERGES quantities
  // ════════════════════════════════════════════════════════════════
  test('POST /api/basket merges quantities for duplicate product', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Basket quantity merge');
    await allure.severity('critical');
    await allure.tag('market', 'basket', 'edge');

    // Necesitamos un producto con stock suficiente para qty=5
    const products = await apiClient.getProducts();
    const product   = products.find(p => p.stock >= 5);
    expect(product).toBeDefined();

    // Primera adición: qty=2
    await apiClient.post('/api/basket', {
      data: { product_id: product!.id, quantity: 2 },
    });

    // Segunda adición del MISMO producto: qty=3
    const response = await apiClient.post('/api/basket', {
      data: { product_id: product!.id, quantity: 3 },
    });

    // La API puede devolver 200 (merge) o 201 — ambos son aceptables
    expect([200, 201]).toContain(response.status);

    // ASSERT: una sola fila con qty=5, no dos filas
    const basket = await apiClient.getBasket();
    const itemsForProduct = basket.items.filter(i => i.product_id === product!.id);

    expect(itemsForProduct.length).toBe(1);            // no duplica filas
    expect(itemsForProduct[0].quantity).toBe(5);       // fusiona cantidades
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-BASK-003 — Adding more than available stock returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/basket returns 400 when quantity exceeds stock', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Stock validation');
    await allure.severity('critical');
    await allure.tag('market', 'basket', 'negative');

    // Creamos un producto con stock controlado (stock=5)
    const product = await apiClient.createProduct({
      product_name: 'Low Stock Item',
      price:        1.99,
      category:     'Pantry',
      stock:        5,
    });

    // Intentamos añadir stock+1
    const response = await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 6 },
    });

    expect(response.status).toBe(400);

    // El mensaje de error debe mencionar el stock disponible
    const body = response.body as any;
    const errorMessage = body?.message ?? body?.error ?? JSON.stringify(body);
    expect(errorMessage).toMatch(/available/i);
    expect(errorMessage).toContain('5');
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-BASK-004 — Stock check accounts for items already in basket
  // ════════════════════════════════════════════════════════════════
  test('POST /api/basket 400 considers quantity already in basket', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Stock validation with existing basket');
    await allure.severity('normal');
    await allure.tag('market', 'basket', 'edge', 'negative');

    // Stock=5, añadimos 3 → quedan 2 disponibles
    const product = await apiClient.createProduct({
      product_name: 'Controlled Stock Item',
      price:        2.50,
      category:     'Pantry',
      stock:        5,
    });

    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 3 },
    });

    // Intentamos añadir 3 más (total sería 6, stock=5) → debe fallar
    const response = await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 3 },
    });

    expect(response.status).toBe(400);

    // El mensaje debe mencionar tanto el stock como lo que ya hay en cesta
    const errorMessage = JSON.stringify(response.body);
    expect(errorMessage).toMatch(/basket/i);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-BASK-005 — quantity=0 returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/basket returns 400 for quantity = 0', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Basket input validation');
    await allure.severity('normal');
    await allure.tag('market', 'basket', 'negative');

    const product = await apiClient.getFirstProduct();

    const response = await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 0 },
    });

    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  quantity=-1 returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/basket returns 400 for negative quantity', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Basket input validation');
    await allure.severity('minor');
    await allure.tag('market', 'basket', 'negative');

    const product = await apiClient.getFirstProduct();

    const response = await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: -1 },
    });

    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-BASK-006 — Deleting a product cascades to basket
  // ════════════════════════════════════════════════════════════════
  test('DELETE product cascades and removes it from basket', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Basket cascade delete');
    await allure.severity('normal');
    await allure.tag('market', 'basket', 'edge');

    // ARRANGE: crear producto y añadirlo a la cesta
    const product = await apiClient.createProduct({
      product_name: 'Cascade Test Item',
      price:        3.00,
      category:     'Pantry',
      stock:        10,
    });

    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 2 },
    });

    // Verificar que está en la cesta
    const basketBefore = await apiClient.getBasket();
    const inBasket = basketBefore.items.find(i => i.product_id === product.id);
    expect(inBasket).toBeDefined();

    // ACT: borrar el producto directamente
    const deleteResponse = await apiClient.delete(`/api/groceries/${product.id}`);
    expect(deleteResponse.status).toBe(200);

    // ASSERT: el producto desaparece de la cesta automáticamente
    const basketAfter = await apiClient.getBasket();
    const stillInBasket = basketAfter.items.find(i => i.product_id === product.id);
    expect(stillInBasket).toBeUndefined();
  });

  // ════════════════════════════════════════════════════════════════
  //  PUT /api/basket — update quantity (absolute, not additive)
  // ════════════════════════════════════════════════════════════════
  test('PUT /api/basket updates quantity to absolute value', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Update basket quantity');
    await allure.severity('normal');
    await allure.tag('market', 'basket');

    const products = await apiClient.getProducts();
    const product   = products.find(p => p.stock >= 5);
    expect(product).toBeDefined();

    // Añadir qty=2 primero
    await apiClient.post('/api/basket', {
      data: { product_id: product!.id, quantity: 2 },
    });

    // PUT con qty=4 — debe establecer qty=4, no sumar
    const response = await apiClient.put('/api/basket', {
      data: { product_id: product!.id, quantity: 4 },
    });

    expect(response.status).toBe(200);

    const basket = await apiClient.getBasket();
    const item = basket.items.find(i => i.product_id === product!.id);
    expect(item!.quantity).toBe(4);   // absoluto, no 2+4=6
  });

  // ════════════════════════════════════════════════════════════════
  //  DELETE /api/basket/clear — empties basket completely
  // ════════════════════════════════════════════════════════════════
  test('DELETE /api/basket/clear empties basket', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Basket Management');
    await allure.story('Clear basket');
    await allure.severity('normal');
    await allure.tag('market', 'basket');

    // Añadir algo primero
    const product = await apiClient.getFirstProduct();
    await apiClient.post('/api/basket', {
      data: { product_id: product.id, quantity: 1 },
    });

    const response = await apiClient.delete('/api/basket/clear');
    expect(response.status).toBe(200);

    const basket = await apiClient.getBasket();
    expect(basket.items.length).toBe(0);
  });
});