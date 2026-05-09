// ┌─────────────────────────────────────────────────────────────────┐
// │  market.schema.ts                                               │
// │  JSON Schemas — Market API (qacloud.dev)                        │
// │  Validados contra respuestas reales — 2026-05-07                │
// └─────────────────────────────────────────────────────────────────┘

type Schema = Record<string, unknown>;

// ─────────────────────────────────────────────────────────────────────────────
//  PRODUCT
//  Fuente: POST /api/groceries (201) · GET /api/groceries (200) · PUT (200)
//          POST /api/reset (200)
//
//  Campos observados en la API real (2026-05-07):
//  - description: siempre presente, habitualmente string vacío ""
//  - owner_id:    UUID del propietario, siempre presente
//  - category:    llega en minúsculas ("bakery", "beverages"...)
// ─────────────────────────────────────────────────────────────────────────────
export const productSchema: Schema = {
  type: 'object',
  required: ['id', 'product_name', 'price', 'category', 'stock', 'weighted'],
  properties: {
    id:           { type: 'string', minLength: 1 },
    product_name: { type: 'string', minLength: 1 },
    price:        { type: 'number', minimum: 0 },
    category:     { type: 'string', minLength: 1 },
    stock:        { type: 'integer', minimum: 0 },
    temperature_zone: {
      anyOf: [
        { type: 'string', enum: ['Dry', 'Frozen', 'Chilled', 'Room Temperature'] },
        { type: 'null' },
      ],
    },
    weighted:    { type: 'boolean' },
    description: { type: 'string' },           // siempre presente, puede ser ""
    owner_id:    { type: 'string', minLength: 1 }, // UUID del propietario
    details: {
      anyOf: [{ type: 'object' }, { type: 'null' }],
    },
    created_at: { type: 'string' },            // ISO 8601
  },
  additionalProperties: true,
};

// ─────────────────────────────────────────────────────────────────────────────
//  PRODUCTS LIST RESPONSE
//  GET /api/groceries → { products: Product[] }
// ─────────────────────────────────────────────────────────────────────────────
export const productsListSchema: Schema = {
  type: 'object',
  required: ['products'],
  properties: {
    products: {
      type:  'array',
      items: productSchema,
    },
  },
  additionalProperties: true,
};

// ─────────────────────────────────────────────────────────────────────────────
//  BASKET ITEM
//  Cada ítem dentro del array 'items' de GET /api/basket
// ─────────────────────────────────────────────────────────────────────────────
export const basketItemSchema: Schema = {
  type: 'object',
  required: ['product_id', 'quantity'],
  properties: {
    product_id:   { type: 'string', minLength: 1 },
    quantity:     { type: 'integer', minimum: 1 },
    product_name: { type: 'string' },
    price:        { type: 'number', minimum: 0 },
    stock:        { type: 'integer', minimum: 0 },
  },
  additionalProperties: true,
};

// ─────────────────────────────────────────────────────────────────────────────
//  BASKET RESPONSE
//  GET /api/basket → { items: BasketItem[] }
// ─────────────────────────────────────────────────────────────────────────────
export const basketResponseSchema: Schema = {
  type: 'object',
  required: ['items'],
  properties: {
    items: {
      type:  'array',
      items: basketItemSchema,
    },
  },
  additionalProperties: true,
};

// ─────────────────────────────────────────────────────────────────────────────
//  ORDER ITEM — snapshot de precio (price_at_purchase)
//
//  ⚠️ DIFERENCIA ENTRE ENDPOINTS:
//  GET /api/orders/:id  → incluye 'product_id' en cada item
//  POST /api/orders     → NO incluye 'product_id'
//  GET /api/orders      → NO incluye 'product_id'
//
//  'product_id' es opcional aquí para cubrir los tres casos.
// ─────────────────────────────────────────────────────────────────────────────
export const orderItemSchema: Schema = {
  type: 'object',
  required: ['product_name', 'price', 'quantity'],
  properties: {
    product_id:       { type: 'string', minLength: 1 }, // presente solo en GET /:id
    product_name:     { type: 'string', minLength: 1 },
    category:         { type: 'string' },
    price:            { type: 'number', minimum: 0 },   // price_at_purchase (TC-ORD-004)
    quantity:         { type: 'integer', minimum: 1 },
    temperature_zone: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
  },
  additionalProperties: true,
};

// ─────────────────────────────────────────────────────────────────────────────
//  ORDER
//  Compartido por: POST /api/orders · GET /api/orders · GET /api/orders/:id
//
//  Campos observados en la respuesta real:
//  - notes y updated_at presentes en GET, ausentes en POST (ambos opcionales)
//  - order_number → patrón O + 5 dígitos (TC-ORD-007)
// ─────────────────────────────────────────────────────────────────────────────
export const orderSchema: Schema = {
  type: 'object',
  required: ['id', 'order_number', 'status', 'total_amount', 'items'],
  properties: {
    id: { type: 'string', minLength: 1 },
    order_number: {
      type:    'string',
      pattern: '^O\\d{5}$',  // TC-ORD-007
    },
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    },
    total_amount: { type: 'number', minimum: 0 },
    items: {
      type:     'array',
      items:    orderItemSchema,
      minItems: 1,
    },
    notes: {
      anyOf: [{ type: 'string' }, { type: 'null' }],
    },
    created_at:  { type: 'string' },   // ISO 8601 — presente siempre
    updated_at:  { type: 'string' },   // ISO 8601 — presente en GET, ausente en POST
  },
  additionalProperties: true,
};

// ─────────────────────────────────────────────────────────────────────────────
//  PLACE ORDER RESPONSE
//  POST /api/orders → { message: string, order: Order }
//
//  Respuesta real observada (2026-05-07):
//  { "message": "Order placed successfully", "order": { ...sin notes ni updated_at } }
// ─────────────────────────────────────────────────────────────────────────────
export const placeOrderResponseSchema: Schema = {
  type: 'object',
  required: ['message', 'order'],
  properties: {
    message: { type: 'string', minLength: 1 },
    order:   orderSchema,
  },
  additionalProperties: true,
};

// ─────────────────────────────────────────────────────────────────────────────
//  ORDERS LIST RESPONSE
//  GET /api/orders → { orders: Order[] }
//
//  ⚠️ NUEVO: la lista envuelve los pedidos en la clave 'orders', no 'order'.
// ─────────────────────────────────────────────────────────────────────────────
export const ordersListSchema: Schema = {
  type: 'object',
  required: ['orders'],
  properties: {
    orders: {
      type:  'array',
      items: orderSchema,
    },
  },
  additionalProperties: true,
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET ORDER BY ID RESPONSE
//  GET /api/orders/:id → Order (objeto directo, sin wrapper)
//
//  Es el único endpoint de órdenes que devuelve el objeto sin clave envolvente.
//  También es el único que incluye 'product_id' dentro de cada order item.
//  Reutilizamos orderSchema directamente — se valida el body completo.
// ─────────────────────────────────────────────────────────────────────────────
export const getOrderByIdSchema: Schema = orderSchema;

// ─────────────────────────────────────────────────────────────────────────────
//  UPDATE ORDER RESPONSE
//  PUT /api/orders/:id → { message: string, order: Order (sin items) }
//
//  A diferencia del POST, el PUT devuelve solo los campos del registro DB.
//  Sin 'items'. Incluye 'user_id' que no aparece en ningún otro endpoint.
//
//  Respuesta real observada (2026-05-07):
//  { message, order: { id, user_id, status, total_amount, notes,
//                      created_at, updated_at, order_number } }
// ─────────────────────────────────────────────────────────────────────────────
export const updateOrderResponseSchema: Schema = {
  type: 'object',
  required: ['message', 'order'],
  properties: {
    message: { type: 'string', minLength: 1 },
    order: {
      type: 'object',
      required: [
        'id', 'user_id', 'status',
        'total_amount', 'notes',
        'created_at', 'updated_at', 'order_number',
      ],
      properties: {
        id:           { type: 'string', minLength: 1 },
        user_id:      { type: 'string', minLength: 1 },
        status: {
          type: 'string',
          enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        },
        total_amount: { type: 'number', minimum: 0 },
        notes: {
          anyOf: [{ type: 'string' }, { type: 'null' }],
        },
        created_at:   { type: 'string' },
        updated_at:   { type: 'string' },
        order_number: { type: 'string', pattern: '^O\\d{5}$' },
      },
      additionalProperties: true,
    },
  },
  additionalProperties: true,
};

// ─────────────────────────────────────────────────────────────────────────────
//  RESET RESPONSE
//  POST /api/reset → { message: string, products: Product[] }
//
//  Nota: la doc indicaba { message, count: number } pero la API real
//  devuelve { message, products[] }. Corregido contra respuesta real.
// ─────────────────────────────────────────────────────────────────────────────
export const resetResponseSchema: Schema = {
  type: 'object',
  required: ['message', 'products'],
  properties: {
    message:  { type: 'string', minLength: 1 },
    products: {
      type:  'array',
      items: productSchema,
    },
  },
  additionalProperties: true,
};