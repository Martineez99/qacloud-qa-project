// ┌─────────────────────────────────────────────────────────────────┐
// │  api.fixture.ts                                                 │
// │  Extiende el test base de Playwright para inyectar ApiClient    │
// │                                                                 │
// │  ¿Por qué un fixture y no instanciar ApiClient en cada test?    │
// │  Playwright garantiza que el request context del fixture vive   │
// │  exactamente lo que dura el test, y lo destruye correctamente   │
// │  al finalizar. Si lo instanciaras en cada test a mano, tendrías │
// │  que gestionar el ciclo de vida tú mismo (y olvidarías cleanup). │
// └─────────────────────────────────────────────────────────────────┘

import { test as base, APIRequestContext } from '@playwright/test';
import { ApiClient } from '../utils/api-client';

// El type que extiende el test base con nuestra fixture
type ApiFixtures = {
  apiClient: ApiClient;
};

/**
 * test extendido con la fixture apiClient.
 * Importa este `test` en lugar del de @playwright/test en tus API tests.
 *
 * Uso en un test:
 *   import { test } from '../fixtures/api.fixture';
 *
 *   test('GET /api/groceries returns products', async ({ apiClient }) => {
 *     const products = await apiClient.getProducts();
 *     expect(products.length).toBeGreaterThan(0);
 *   });
 */
export const test = base.extend<ApiFixtures>({
  apiClient: async ({ request }, use) => {
    // request es el APIRequestContext que Playwright gestiona
    const client = new ApiClient(request);

    // use() le da el cliente al test. Todo lo que escribas DESPUÉS
    // de use() se ejecuta como cleanup (equivale a afterEach).
    await use(client);

    // Aquí podríamos añadir cleanup si fuera necesario,
    // por ejemplo limpiar datos que el test creó y no eliminó.
    // Por ahora, el reset() al inicio de cada suite ya cubre esto.
  },
});

// Re-exportamos expect para que los tests solo necesiten un import
export { expect } from '@playwright/test';