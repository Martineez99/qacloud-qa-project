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
import {
  Property,
  RoomType,
  Booking,
  Review,
  BookingStatus,
  CreatePropertyPayload,
  UpdatePropertyPayload,
  CreateRoomTypePayload,
  UpdateRoomTypePayload,
  CreateBookingPayload,
  UpdateBookingPayload,
  CreateReviewPayload,
} from '../types/hotel.types';

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
//  MÉTODOS DE DOMINIO — HOTEL
//  Añade esta sección en api-client.ts justo después de getOrders()
//  y antes de los helpers privados (url, headers, parse).
// ══════════════════════════════════════════════════════════════════

  /**
   * Resetea el estado del Hotel para el usuario actual.
   * Restaura las 5 properties y 14 room types seed.
   * También VACÍA bookings y reviews por completo (confirmado en Swagger:
   * "Reset all hotel data for the authenticated user").
   */
  async hotelReset(): Promise<void> {
    const response = await this.post<void>('/api/hotel/reset');
    if (!response.ok) {
      throw new Error(`[ApiClient] hotelReset() falló con status ${response.status}`);
    }
  }

  /**
   * Devuelve todas las properties del usuario.
   */
  async getProperties(): Promise<Property[]> {
    const response = await this.get<Property[]>('/api/hotel/properties');
    if (!response.ok) throw new Error(`getProperties() falló: ${response.status}`);
    return response.body;
  }

  /**
   * Crea una property y la devuelve.
   */
  async createProperty(payload: CreatePropertyPayload): Promise<Property> {
    const response = await this.post<Property>('/api/hotel/properties', { data: payload });
    if (!response.ok) {
      throw new Error(`createProperty() falló: ${response.status} — ${JSON.stringify(response.body)}`);
    }
    return response.body;
  }

  /**
   * Devuelve una property concreta por ID.
   */
  async getPropertyById(propertyId: string): Promise<Property> {
    const response = await this.get<Property>(`/api/hotel/properties/${propertyId}`);
    if (!response.ok) throw new Error(`getPropertyById() falló: ${response.status}`);
    return response.body;
  }

  /**
   * Actualiza una property (update parcial — solo cambia los campos enviados).
   */
  async updateProperty(propertyId: string, payload: UpdatePropertyPayload): Promise<Property> {
    const response = await this.put<Property>(`/api/hotel/properties/${propertyId}`, { data: payload });
    if (!response.ok) {
      throw new Error(`updateProperty() falló: ${response.status} — ${JSON.stringify(response.body)}`);
    }
    return response.body;
  }

  /**
   * Elimina una property por ID.
   * ⚠️ Cascade: también elimina sus room types asociados.
   */
  async deleteProperty(propertyId: string): Promise<void> {
    const response = await this.delete<void>(`/api/hotel/properties/${propertyId}`);
    if (!response.ok) {
      throw new Error(`deleteProperty() falló: ${response.status}`);
    }
  }

  /**
   * Devuelve todos los room types del usuario.
   */
  async getRoomTypes(): Promise<RoomType[]> {
    const response = await this.get<RoomType[]>('/api/hotel/room-types');
    if (!response.ok) throw new Error(`getRoomTypes() falló: ${response.status}`);
    return response.body;
  }

  /**
   * Crea un room type y lo devuelve.
   */
  async createRoomType(payload: CreateRoomTypePayload): Promise<RoomType> {
    const response = await this.post<RoomType>('/api/hotel/room-types', { data: payload });
    if (!response.ok) {
      throw new Error(`createRoomType() falló: ${response.status} — ${JSON.stringify(response.body)}`);
    }
    return response.body;
  }

  /**
   * Devuelve un room type concreto por ID.
   */
  async getRoomTypeById(roomTypeId: string): Promise<RoomType> {
    const response = await this.get<RoomType>(`/api/hotel/room-types/${roomTypeId}`);
    if (!response.ok) throw new Error(`getRoomTypeById() falló: ${response.status}`);
    return response.body;
  }

  /**
   * Actualiza un room type (update parcial — solo cambia los campos enviados).
   */
  async updateRoomType(roomTypeId: string, payload: UpdateRoomTypePayload): Promise<RoomType> {
    const response = await this.put<RoomType>(`/api/hotel/room-types/${roomTypeId}`, { data: payload });
    if (!response.ok) {
      throw new Error(`updateRoomType() falló: ${response.status} — ${JSON.stringify(response.body)}`);
    }
    return response.body;
  }

  /**
   * Elimina un room type por ID.
   */
  async deleteRoomType(roomTypeId: string): Promise<void> {
    const response = await this.delete<void>(`/api/hotel/room-types/${roomTypeId}`);
    if (!response.ok) {
      throw new Error(`deleteRoomType() falló: ${response.status}`);
    }
  }

  /**
   * Busca una property por nombre exacto entre las seed data.
   * Útil en beforeAll para obtener el ID sin hardcodearlo.
   */
  async getPropertyByName(name: string): Promise<Property> {
    const properties = await this.getProperties();
    const found = properties.find(p => p.name === name);
    if (!found) {
      throw new Error(`[ApiClient] Property "${name}" no encontrada. ¿Hiciste hotelReset()?`);
    }
    return found;
  }

  /**
   * Busca un room type por nombre dentro de una property concreta.
   */
  async getRoomTypeByName(propertyId: string, roomTypeName: string): Promise<RoomType> {
    const roomTypes = await this.getRoomTypes();
    const found = roomTypes.find(
      rt => rt.property_id === propertyId && rt.name === roomTypeName
    );
    if (!found) {
      throw new Error(`[ApiClient] RoomType "${roomTypeName}" no encontrado en property ${propertyId}`);
    }
    return found;
  }

  /**
   * Crea una booking y la devuelve.
   */
  async createBooking(payload: CreateBookingPayload): Promise<Booking> {
    const response = await this.post<Booking>('/api/hotel/bookings', { data: payload });
    if (!response.ok) {
      throw new Error(`createBooking() falló: ${response.status} — ${JSON.stringify(response.body)}`);
    }
    return response.body;
  }

  /**
   * Actualiza el status de una booking.
   * Si el status es CANCELLED, cancellation_reason es obligatorio.
   *
   * ⚠️ Usa PATCH sobre el endpoint dedicado /status, NO PUT sobre la
   * booking en sí. Confirmado en la Swagger real de qacloud.dev:
   * PATCH /api/hotel/bookings/:id/status
   */
  async updateBookingStatus(bookingId: string, payload: UpdateBookingPayload): Promise<Booking> {
    const response = await this.patch<Booking>(`/api/hotel/bookings/${bookingId}/status`, { data: payload });
    if (!response.ok) {
      throw new Error(`updateBookingStatus() falló: ${response.status} — ${JSON.stringify(response.body)}`);
    }
    return response.body;
  }

  /**
   * Método conveniente: lleva una booking al status CHECKED_OUT
   * recorriendo todo el lifecycle (PENDING→CONFIRMED→CHECKED_IN→CHECKED_OUT).
   * Útil en beforeAll de tests que necesitan una booking ya completada
   * (ej: para poder crear una review).
   */
  async driveBookingToCheckedOut(bookingId: string): Promise<Booking> {
    await this.updateBookingStatus(bookingId, { status: 'CONFIRMED' });
    await this.updateBookingStatus(bookingId, { status: 'CHECKED_IN' });
    return this.updateBookingStatus(bookingId, { status: 'CHECKED_OUT' });
  }

  /**
   * Elimina una booking por ID.
   */
  async deleteBooking(bookingId: string): Promise<void> {
    const response = await this.delete<void>(`/api/hotel/bookings/${bookingId}`);
    if (!response.ok) {
      throw new Error(`deleteBooking() falló: ${response.status}`);
    }
  }

  /**
   * Devuelve todas las bookings, opcionalmente filtradas por status.
   */
  async getBookings(status?: BookingStatus): Promise<Booking[]> {
    const params = status ? { status } : undefined;
    const response = await this.get<Booking[]>('/api/hotel/bookings', { params });
    if (!response.ok) throw new Error(`getBookings() falló: ${response.status}`);
    return response.body;
  }

  /**
   * Devuelve una booking concreta por ID.
   */
  async getBookingById(bookingId: string): Promise<Booking> {
    const response = await this.get<Booking>(`/api/hotel/bookings/${bookingId}`);
    if (!response.ok) throw new Error(`getBookingById() falló: ${response.status}`);
    return response.body;
  }

  /**
   * Crea una review y la devuelve.
   * Precondición de negocio: la booking referenciada debe estar CHECKED_OUT
   * (ver driveBookingToCheckedOut arriba).
   */
  async createReview(payload: CreateReviewPayload): Promise<Review> {
    const response = await this.post<Review>('/api/hotel/reviews', { data: payload });
    if (!response.ok) {
      throw new Error(`createReview() falló: ${response.status} — ${JSON.stringify(response.body)}`);
    }
    return response.body;
  }

  /**
   * Devuelve todas las reviews del usuario.
   */
  async getReviews(): Promise<Review[]> {
    const response = await this.get<Review[]>('/api/hotel/reviews');
    if (!response.ok) throw new Error(`getReviews() falló: ${response.status}`);
    return response.body;
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