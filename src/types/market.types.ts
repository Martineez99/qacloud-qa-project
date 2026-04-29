// ┌─────────────────────────────────────────────────────────────────┐
// │  market.types.ts                                                │
// │  Interfaces que modelan los recursos de la Market API           │
// └─────────────────────────────────────────────────────────────────┘

/**
 * ¿Por qué definimos estos tipos aquí y no dentro de los tests?
 *
 * 1. Reutilización: el mismo Product se usa en E2E tests, API tests y el data-factory
 * 2. Contract testing: cuando validamos que la API devuelve la estructura correcta,
 *    TypeScript nos avisa si el schema cambia sin que actualicemos los tests
 * 3. Autocomplete: al escribir `product.` en tu editor ves todos los campos disponibles
 */

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  description?: string;
  imageUrl?: string;
}

export interface BasketItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Basket {
  id: string;
  items: BasketItem[];
  total: number;
  itemCount: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  items: BasketItem[];
  total: number;
  createdAt: string;
}

/**
 * Union type de estados posibles de una orden.
 * Esto nos protege de errores tipográficos en assertions:
 * expect(order.status).toBe('pending')  ✅
 * expect(order.status).toBe('panding')  ❌ TypeScript lo detecta
 */
export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

// ── Payloads de request (lo que ENVIAMOS) ────────────────────────────────────

export interface AddToBasketPayload {
  productId: string;
  quantity: number;
}

export interface CreateProductPayload {
  name: string;
  price: number;
  stock: number;
  category: string;
  description?: string;
}