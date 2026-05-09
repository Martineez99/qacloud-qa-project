// ┌─────────────────────────────────────────────────────────────────┐
// │  api-client.ts                                                  │
// │  Wrapper sobre el APIRequestContext de Playwright               │
// │                                                                 │
// │  Responsabilidades:                                             │
// │    1. Inyectar auth headers en cada request                     │
// │    2. Construir URLs completas desde endpoints relativos        │
// │    3. Parsear responses a nuestro ApiResponse<T> unificado      │
// │    4. Exponer métodos de dominio (reset, etc.)                  │
// └─────────────────────────────────────────────────────────────────┘

import { APIRequestContext } from '@playwright/test';
import { ApiResponse, RequestOptions } from '../types/common.types';
import {
  Product,
  Basket,
  Order,
  AddToBasketPayload,
  CreateProductPayload,
} from '../types/market.types';

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  /**
   * Constructor: recibe el request context de Playwright y las credenciales.
   *
   * ¿Por qué recibir APIRequestContext en lugar de crear uno propio?
   * Playwright gestiona el ciclo de vida del contexto (cookies, sessions,
   * HAR recording, interceptors). Si creáramos uno propio perderíamos toda
   * esa integración. Al recibirlo como parámetro, el contexto lo gestiona
   * el fixture — y nosotros solo lo usamos.
   *
   * ¿Por qué los valores default con ??
   * Para que en CI las variables de entorno se inyecten directamente,
   * y en local se lean del .env (que dotenv carga en playwright.config.ts).
   */
  constructor(
    private readonly request: APIRequestContext,
    baseUrl?: string,
    apiKey?: string
  ) {
    this.baseUrl = (baseUrl ?? process.env.QACLOUD_BASE_URL ?? '').replace(/\/$/, '');
    const resolvedApiKey = apiKey ?? process.env.QACLOUD_API_KEY ?? '';

    if (!this.baseUrl) {
      throw new Error('[ApiClient] QACLOUD_BASE_URL no está definida. Revisa tu .env');
    }
    if (!resolvedApiKey) {
      throw new Error('[ApiClient] QACLOUD_API_KEY no está definida. Revisa tu .env');
    }

    // Estos headers van en TODAS las requests. Si un test necesita
    // sobreescribir alguno (ej: testear auth inválida), puede pasarlo
    // en options.headers y se mezclará aquí, tomando precedencia.
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Authorization': resolvedApiKey,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  MÉTODOS HTTP GENÉRICOS
  //  Tipados con genéricos <T> para que TypeScript sepa qué viene back
  // ══════════════════════════════════════════════════════════════════

  async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response = await this.request.get(this.url(endpoint), {
      headers: this.headers(options?.headers),
      params: options?.params as Record<string, string>,
      failOnStatusCode: options?.failOnStatusCode ?? false,
    });
    return this.parse<T>(response);
  }

  async post<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response = await this.request.post(this.url(endpoint), {
      headers: this.headers(options?.headers),
      data: options?.data,
      params: options?.params as Record<string, string>,
      failOnStatusCode: options?.failOnStatusCode ?? false,
    });
    return this.parse<T>(response);
  }

  async put<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response = await this.request.put(this.url(endpoint), {
      headers: this.headers(options?.headers),
      data: options?.data,
      params: options?.params as Record<string, string>,
      failOnStatusCode: options?.failOnStatusCode ?? false,
    });
    return this.parse<T>(response);
  }

  async patch<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response = await this.request.patch(this.url(endpoint), {
      headers: this.headers(options?.headers),
      data: options?.data,
      params: options?.params as Record<string, string>,
      failOnStatusCode: options?.failOnStatusCode ?? false,
    });
    return this.parse<T>(response);
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const response = await this.request.delete(this.url(endpoint), {
      headers: this.headers(options?.headers),
      data: options?.data,
      params: options?.params as Record<string, string>,
      failOnStatusCode: options?.failOnStatusCode ?? false,
    });
    return this.parse<T>(response);
  }

  // ══════════════════════════════════════════════════════════════════
  //  MÉTODOS DE DOMINIO — MARKET
  //  Estos métodos conocen la API de qacloud.dev específicamente.
  //  Úsalos en los beforeAll/beforeEach para montar el estado del test.
  //  Úsalos en los tests para el "ARRANGE" sin ensuciar el test con
  //  detalles de URL o payload.
  // ══════════════════════════════════════════════════════════════════

  /**
   * Resetea el estado de toda la plataforma para el usuario actual.
   * SIEMPRE debe llamarse al inicio de cada test suite (beforeAll).
   * Garantiza determinismo: el test parte desde cero, independiente
   * de lo que haya dejado el test anterior.
   */
  async reset(): Promise<void> {
    const response = await this.post<void>('/api/reset');
    if (!response.ok) {
      throw new Error(`[ApiClient] reset() falló con status ${response.status}`);
    }
  }

  /**
   * Devuelve todos los productos disponibles.
   * Retorna el array directamente (ya parseado y tipado).
   */
  async getProducts(): Promise<Product[]> {
    const response = await this.get<Product[] | { products: Product[] }>('/api/groceries');
    if (!response.ok) throw new Error(`getProducts() falló: ${response.status}`);
    // La API puede devolver array directo o { products: [...] }
    return Array.isArray(response.body) ? response.body : response.body.products;
  }

  /**
   * Devuelve el primer producto disponible.
   * Útil en tests donde necesitas "un producto cualquiera" para el ARRANGE
   * sin importar cuál específicamente.
   */
  async getFirstProduct(): Promise<Product> {
    const products = await this.getProducts();
    if (products.length === 0) {
      throw new Error('[ApiClient] No hay productos disponibles. ¿Hiciste reset()?');
    }
    return products[0];
  }

  /**
   * Añade un producto al basket del usuario actual.
   * @param productId  - ID del producto
   * @param quantity   - Cantidad (mínimo 1)
   */
  async addToBasket(productId: string, quantity = 1): Promise<Basket> {
    const payload: AddToBasketPayload = { product_id: productId, quantity };
    const response = await this.post<Basket>('/api/basket', { data: payload });
    if (!response.ok) {
      throw new Error(`addToBasket() falló: ${response.status} — ${JSON.stringify(response.body)}`);
    }
    return response.body;
  }

  /**
   * Obtiene el estado actual del basket.
   */
  async getBasket(): Promise<Basket> {
    const response = await this.get<Basket>('/api/basket');
    if (!response.ok) throw new Error(`getBasket() falló: ${response.status}`);
    return response.body;
  }

  /**
   * Crea un producto nuevo (requiere rol admin en qacloud.dev).
   */
  async createProduct(payload: CreateProductPayload): Promise<Product> {
    const response = await this.post<Product>('/api/groceries', { data: payload });
    if (!response.ok) {
      throw new Error(`createProduct() falló: ${response.status} — ${JSON.stringify(response.body)}`);
    }
    return response.body;
  }

  /**
   * Obtiene todas las órdenes del usuario actual.
   */
  async getOrders(): Promise<Order[]> {
    const response = await this.get<Order[] | { orders: Order[] }>('/api/orders');
    if (!response.ok) throw new Error(`getOrders() falló: ${response.status}`);
    return Array.isArray(response.body) ? response.body : response.body.orders;
  }

  // ══════════════════════════════════════════════════════════════════
  //  HELPERS PRIVADOS
  // ══════════════════════════════════════════════════════════════════

  /**
   * Construye la URL completa desde un endpoint relativo.
   * Acepta '/api/groceries' y también 'api/groceries' (sin slash inicial).
   */
  private url(endpoint: string): string {
    const clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${clean}`;
  }

  /**
   * Mezcla los headers default con los que se pasan en cada request.
   * Los headers del llamador SOBREESCRIBEN los default.
   * Esto permite testear autenticación inválida sin cambiar la clase:
   *   await api.get('/api/protected', { headers: { Authorization: 'invalid' } })
   */
  private headers(extra?: Record<string, string>): Record<string, string> {
    return { ...this.defaultHeaders, ...extra };
  }

  /**
   * Convierte el APIResponse crudo de Playwright a nuestro ApiResponse<T>.
   *
   * ¿Por qué intentar JSON y caer en texto?
   * Algunos endpoints devuelven texto plano en errores (ej: 500 con HTML).
   * Si solo intentáramos JSON, el test explotaría con un error de parseo
   * en lugar de mostrar el status + body para diagnosticar.
   */
  private async parse<T>(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<ApiResponse<T>> {
    let body: T;

    const contentType = response.headers()['content-type'] ?? '';

    if (contentType.includes('application/json')) {
      body = (await response.json()) as T;
    } else {
      body = (await response.text()) as unknown as T;
    }

    return {
      status: response.status(),
      body,
      headers: response.headers(),
      ok: response.ok(),
    };
  }
}