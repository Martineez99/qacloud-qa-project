// ┌─────────────────────────────────────────────────────────────────┐
// │  products.api.spec.ts                                           │
// │  CRUD completo de productos + filtros + seguridad               │
// │                                                                 │
// │  Cubre: TC-PROD-001 a TC-PROD-007                               │
// │  Prerequisito: QACLOUD_API_KEY válida en .env                   │
// └─────────────────────────────────────────────────────────────────┘

import { test, expect } from '../../fixtures/api.fixture';
import { allure } from 'allure-playwright';
import { CreateProductPayload, Product } from '../../types/market.types';

test.describe('Market Products API', () => {
  
  // ── beforeAll: estado determinista ──────────────────────────────
  // Reset SIEMPRE antes de la suite completa. Si un test anterior
  // dejó el catálogo modificado, nuestras assertions sobre "≥ 25
  // productos" o "categoría Dairy existe" serían frágiles sin esto.
  test.beforeAll(async ({ apiClient }) => {
    await apiClient.reset();
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-PROD-001 — GET all products returns seeded catalog
  // ════════════════════════════════════════════════════════════════
  test('GET /api/groceries returns 200 with seeded product array', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('List products');
    await allure.severity('critical');
    await allure.tag('smoke', 'market', 'products');

    const response = await apiClient.get<Product[]>('/api/groceries');

    expect(response.status).toBe(200);

    // La API devuelve al menos los ~25-30 productos seed
    const products = Array.isArray(response.body)
      ? response.body
      : (response.body as any).products;

    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThanOrEqual(1);

    // Verificamos la forma del primer producto (contract mínimo)
    const first = products[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('product_name');
    expect(first).toHaveProperty('price');
    expect(first).toHaveProperty('stock');
    expect(first).toHaveProperty('category');
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-PROD-002 — POST create product with all optional fields
  // ════════════════════════════════════════════════════════════════
  test('POST /api/groceries creates product with all fields and returns 201', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('Create product');
    await allure.severity('normal');
    await allure.tag('market', 'products', 'crud');

    const payload: CreateProductPayload = {
      product_name:     'QA Test Cheddar',
      price:            4.99,
      category:         'Dairy',
      stock:            50,
      temperature_zone: 'Chilled',
      weighted:         false,
      details: {
        brand:  'QA Brand',
        weight: '400g',
      },
    };

    const response = await apiClient.post<Product>('/api/groceries', { data: payload });

    expect(response.status).toBe(201);

    const created = response.body;
    expect(created.id).toBeTruthy();
    expect(created.product_name).toBe(payload.product_name);
    expect(created.price).toBe(payload.price);
    expect(created.category).toBe(payload.category);
    expect(created.stock).toBe(payload.stock);
    expect(created.temperature_zone).toBe(payload.temperature_zone);
    expect(created.weighted).toBe(payload.weighted);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-PROD-003 — POST with invalid temperature_zone returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/groceries returns 400 for invalid temperature_zone', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('Create product validation');
    await allure.severity('normal');
    await allure.tag('market', 'products', 'negative');

    const response = await apiClient.post('/api/groceries', {
      data: {
        product_name:     'Bad Zone Product',
        price:            1.00,
        category:         'Dairy',
        temperature_zone: 'Warm',   // ← valor inválido documentado
      },
    });

    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-PROD-002b — POST with only required fields returns 201
  // ════════════════════════════════════════════════════════════════
  test('POST /api/groceries creates product with only required fields', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('Create product minimal');
    await allure.severity('normal');
    await allure.tag('market', 'products', 'crud');

    const response = await apiClient.post<Product>('/api/groceries', {
      data: {
        product_name: 'Minimal Product',
        price:        0.99,
        category:     'Pantry',
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.product_name).toBe('Minimal Product');
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-PROD sin campos requeridos — returns 400
  // ════════════════════════════════════════════════════════════════
  test('POST /api/groceries returns 400 when required fields are missing', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('Create product validation');
    await allure.severity('normal');
    await allure.tag('market', 'products', 'negative');

    // Sin product_name
    const response = await apiClient.post('/api/groceries', {
      data: { price: 2.99, category: 'Dairy' },
    });

    expect(response.status).toBe(400);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-PROD-004 — Filter by multiple categories (comma-separated)
  // ════════════════════════════════════════════════════════════════
  test('GET /api/groceries/filter returns only matching categories', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('Filter products');
    await allure.severity('normal');
    await allure.tag('market', 'products', 'filter');

    const response = await apiClient.get<Product[]>('/api/groceries/filter', {
      params: { category: 'Dairy,Meat' },
    });

    expect(response.status).toBe(200);

    const products = Array.isArray(response.body)
      ? response.body
      : (response.body as any).products ?? [];

    // Todos los productos devueltos deben ser Dairy o Meat
    for (const product of products) {
      expect(['Dairy', 'Meat']).toContain(product.category);
    }
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-PROD-004b — Filter by nonexistent category returns empty
  // ════════════════════════════════════════════════════════════════
  test('GET /api/groceries/filter returns empty array for nonexistent category', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('Filter products edge cases');
    await allure.severity('minor');
    await allure.tag('market', 'products', 'filter', 'edge');

    const response = await apiClient.get<Product[]>('/api/groceries/filter', {
      params: { category: 'Unicorn' },
    });

    expect(response.status).toBe(200);

    const products = Array.isArray(response.body)
      ? response.body
      : (response.body as any).products ?? [];

    expect(products.length).toBe(0);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-PROD-005 — Invalid API key returns 401
  // ════════════════════════════════════════════════════════════════
  test('GET /api/groceries returns 401 for invalid API key', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('Authentication');
    await allure.severity('critical');
    await allure.tag('market', 'products', 'security', 'auth');

    const response = await apiClient.get('/api/groceries', {
      headers: { Authorization: 'qac_live_invalid_key_for_testing' },
    });

    expect(response.status).toBe(401);
  });

  // ════════════════════════════════════════════════════════════════
  //  TC-PROD-007 — PUT partial update only changes the sent field
  // ════════════════════════════════════════════════════════════════
  test('PUT /api/groceries/:id partial update only changes price', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('Update product');
    await allure.severity('normal');
    await allure.tag('market', 'products', 'crud');

    // ARRANGE: necesitamos el ID de un producto real
    const products = await apiClient.getProducts();
    const target = products[0];
    const originalName  = target.product_name;
    const originalStock = target.stock;
    const newPrice      = 999.99;

    // ACT: actualizamos SOLO el precio
    const updateResponse = await apiClient.put<Product>(`/api/groceries/${target.id}`, {
      data: { price: newPrice },
    });

    expect(updateResponse.status).toBe(200);

    // ASSERT: solo el precio cambia, los demás campos permanecen iguales
    const updated = updateResponse.body;
    expect(updated.price).toBe(newPrice);
    expect(updated.product_name).toBe(originalName);   // no cambió
    expect(updated.stock).toBe(originalStock);         // no cambió
  });

  // ════════════════════════════════════════════════════════════════
  //  DELETE — product is removed from catalog
  // ════════════════════════════════════════════════════════════════
  test('DELETE /api/groceries/:id removes product from catalog', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('Delete product');
    await allure.severity('normal');
    await allure.tag('market', 'products', 'crud');

    // ARRANGE: crear un producto específico para borrar (no tocamos el seed)
    const created = await apiClient.createProduct({
      product_name: 'Product To Delete',
      price:        1.00,
      category:     'Pantry',
    });

    // ACT
    const deleteResponse = await apiClient.delete(`/api/groceries/${created.id}`);
    expect(deleteResponse.status).toBe(200);

    // ASSERT: ya no aparece en el listado
    const afterDelete = await apiClient.getProducts();
    const found = afterDelete.find(p => p.id === created.id);
    expect(found).toBeUndefined();
  });

  // ════════════════════════════════════════════════════════════════
  //  DELETE nonexistent ID returns 404
  // ════════════════════════════════════════════════════════════════
  test('DELETE /api/groceries/:id returns 404 for nonexistent id', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('Delete product edge cases');
    await allure.severity('minor');
    await allure.tag('market', 'products', 'negative');

    const response = await apiClient.delete('/api/groceries/nonexistent-id-00000');
    expect(response.status).toBe(404);
  });

  // ════════════════════════════════════════════════════════════════
  //  POST /api/reset — restores catalog to seed state
  // ════════════════════════════════════════════════════════════════
  test('POST /api/reset restores seeded products', async ({ apiClient }) => {
    await allure.epic('Market App');
    await allure.feature('Product Management');
    await allure.story('Reset catalog');
    await allure.severity('normal');
    await allure.tag('market', 'products');

    // ARRANGE: borrar todos los productos con delete de algunos
    const products = await apiClient.getProducts();
    // Borramos el primero para "romper" el estado
    await apiClient.delete(`/api/groceries/${products[0].id}`);

    // ACT
    const resetResponse = await apiClient.post('/api/reset');
    expect(resetResponse.status).toBe(200);

    // ASSERT: el catálogo vuelve a tener productos seed
    const afterReset = await apiClient.getProducts();
    expect(afterReset.length).toBeGreaterThanOrEqual(25);
  });
});