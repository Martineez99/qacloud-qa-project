// ┌─────────────────────────────────────────────────────────────────┐
// │  market.types.ts                                                │
// │  Interfaces que modelan los recursos de la Market API           │
// │                                                                 │
// │  IMPORTANTE: los nombres de campo siguen la convención          │
// │  snake_case de la API REST de qacloud.dev. No camelCase.         │
// │  Así los tests pueden hacer assertions directas contra el body   │
// │  parseado sin transformaciones intermedias.                     │
// └─────────────────────────────────────────────────────────────────┘

// ── Tipos auxiliares ──────────────────────────────────────────────

/**
 * Los únicos valores válidos para temperature_zone.
 * Si la API añade uno nuevo y no actualizamos este union, TypeScript
 * nos avisa en compile time antes de que fallen los tests en runtime.
 */
export type TemperatureZone = 'Dry' | 'Frozen' | 'Chilled' | 'Room Temperature';

export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

// ── Recursos principales ──────────────────────────────────────────

export interface Product {
  id: string;
  product_name: string;
  price: number;
  stock: number;
  category: string;
  temperature_zone?: TemperatureZone;
  weighted?: boolean;
  details?: Record<string, unknown>;
}

/**
 * Snapshot de un producto en el momento de la compra.
 * Los campos son inmutables: aunque el producto se actualice o borre,
 * este snapshot conserva los valores originales. Es el corazón del
 * test TC-ORD-004 (price_at_purchase integrity).
 */
export interface OrderItem {
  product_id: string;
  product_name: string;
  category: string;
  price_at_purchase: number;
  temperature_zone?: TemperatureZone;
  quantity: number;
  subtotal: number;
}

export interface BasketItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  subtotal: number;
  stock_available?: number;
}

export interface Basket {
  items: BasketItem[];
  total: number;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  order_items: OrderItem[];
  total_amount: number;
  created_at: string;
  notes?: string;
}

// ── Payloads de request ───────────────────────────────────────────

export interface AddToBasketPayload {
  product_id: string;
  quantity: number;
}

export interface UpdateBasketPayload {
  product_id: string;
  quantity: number;
}

export interface CreateProductPayload {
  product_name: string;
  price: number;
  category: string;
  stock?: number;
  temperature_zone?: TemperatureZone;
  weighted?: boolean;
  details?: Record<string, unknown>;
}

export interface UpdateProductPayload {
  product_name?: string;
  price?: number;
  category?: string;
  stock?: number;
  temperature_zone?: TemperatureZone;
  weighted?: boolean;
  details?: Record<string, unknown>;
}

export interface UpdateOrderPayload {
  status?: OrderStatus;
  notes?: string;
}