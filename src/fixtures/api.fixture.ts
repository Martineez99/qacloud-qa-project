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

type ApiFixtures = {
  apiClient: ApiClient;
};

export const test = base.extend<ApiFixtures>({
  apiClient: async ({ request }, use) => {
    const client = new ApiClient(request);
    await use(client);
  },
});

export { expect } from '@playwright/test';