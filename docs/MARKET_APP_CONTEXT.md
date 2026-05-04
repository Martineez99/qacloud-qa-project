# 🛒 Market App — Documentación de Contexto QA

> **URL de la app:** `https://www.qacloud.dev/market/<username>`  
> **Swagger UI:** `https://www.qacloud.dev/market/docs`  
> **Wiki oficial:** `https://www.qacloud.dev/market/wiki`  
> **Data Viewer:** `https://www.qacloud.dev/market-viewer.html`  
> **Nivel:** All levels · Foco principal del proyecto QA Cloud

---

## 📋 Índice

1. [Descripción General](#1-descripción-general)
2. [Quick Start](#2-quick-start)
3. [Características Clave para QA](#3-características-clave-para-qa)
4. [Catálogo de Productos (Seed Data)](#4-catálogo-de-productos-seed-data)
5. [UI Overview](#5-ui-overview)
6. [Flujos de la Aplicación](#6-flujos-de-la-aplicación)
7. [Referencia de Endpoints API](#7-referencia-de-endpoints-api)
8. [Test Cases — API](#8-test-cases--api)
9. [Test Cases — UI](#9-test-cases--ui)
10. [QA Tasks (Hands-On)](#10-qa-tasks-hands-on)

---

## 1. Descripción General

El **Market Application** es una API REST de e-commerce de supermercado que simula una tienda online real. Es la aplicación **más completa** de la plataforma qacloud y el foco principal del proyecto de automatización.

Cada usuario recibe su propio **entorno de datos aislado**: un catálogo personal pre-seeded con artículos de supermercado, una cesta vacía y un historial de pedidos vacío. Los datos **nunca se mezclan** entre usuarios, lo que permite ejecutar tests destructivos (delete, reset) con total seguridad.

### Arquitectura de datos

```
User (api_key)
 ├── Products (catálogo personal, ~25-30 items por defecto)
 ├── Basket   (cesta activa, ítems con cantidad)
 └── Orders   (historial de pedidos con snapshot de precios)
```

---

## 2. Quick Start

```powershell
# 1. Registrar cuenta → obtener api_key
POST /api/register

# 2. Explorar productos
GET /api/groceries
# Header: Authorization: qac_live_...

# 3. Añadir ítem a la cesta
POST /api/basket
# Body: { "product_id": "...", "quantity": 2 }

# 4. Colocar pedido (cesta se vacía, stock se decrementa)
POST /api/orders
```

---

## 3. Características Clave para QA

Estas son las **características diseñadas específicamente** para practicar detección de bugs y patrones avanzados de testing:

| Característica | Comportamiento | Relevancia QA |
|---|---|---|
| **Stock validation** | Añadir más unidades que el stock disponible devuelve error | Edge cases, mensajes de error |
| **Price snapshot** | `price_at_purchase` se fija al colocar el pedido; no cambia aunque el producto se actualice | Data integrity testing |
| **Basket accumulation** | Añadir el mismo producto dos veces **fusiona** cantidades, no duplica filas | Merge logic, race conditions |
| **Order number format** | `O` + 5 dígitos aleatorios (ej: `O40699`) | Regex validation |
| **Data isolation** | Usar la API key de otro usuario devuelve datos vacíos, no error | Security testing |
| **Filter API** | Filtro multi-valor de categoría, filtro booleano weighted, sort order | Combinatoria de parámetros |
| **Reset endpoint** | `POST /api/reset` restaura el catálogo al estado por defecto | Setup determinista en tests |
| **Cascade delete** | Borrar un producto lo elimina automáticamente de la cesta | Referential integrity |
| **Stock no se restaura** | Cancelar/borrar un pedido NO restaura el stock (comportamiento intencional) | Bug hunting, business logic |

---

## 4. Catálogo de Productos (Seed Data)

Al registrarse, el usuario recibe **25-30 productos pre-seeded** distribuidos en 8 categorías:

| Categoría | Ejemplos de productos | Zona de temperatura típica |
|---|---|---|
| **Dairy** | Milk, Yogurt, Cheese, Butter | Chilled |
| **Bakery** | Bread, Croissants, Rolls | Dry / Room Temperature |
| **Meat** | Chicken, Beef, Pork | Chilled / Frozen |
| **Produce** | Apples, Tomatoes, Carrots | Chilled / Room Temperature |
| **Beverages** | Orange Juice, Sparkling Water | Chilled / Dry |
| **Frozen** | Ice Cream, Frozen Pizza | Frozen |
| **Deli** | Ham, Salami, Hummus | Chilled |
| **Pantry** | Pasta, Rice, Canned Beans | Dry |

> **Temperatura zones válidas:** `Dry` · `Frozen` · `Chilled` · `Room Temperature`

---

## 5. UI Overview

La aplicación tiene interfaz web en `/market/<username>` con **3 tabs** y un dashboard de stats persistente.

### Stats Dashboard (header persistente)

| Counter | Qué muestra | Cuándo actualiza |
|---|---|---|
| **Products** | Total de productos en el catálogo | Tras crear o borrar un producto |
| **Basket Items** | Cantidad total de todos los ítems en cesta | Tras añadir, quitar o colocar pedido |
| **Orders** | Total de pedidos colocados | Tras colocar o borrar un pedido |
| **Total Value** | Suma de (precio × stock) de TODO el catálogo | Tras cambiar precio o stock de cualquier producto |

> ⚠️ **Total Value** = valor monetario del inventario completo, **NO** el total de la cesta ni de pedidos.

### Tab: Products

- **Sidebar izquierdo:** filtros por categoría (All Products, Dairy, Produce, Beverages, Meat, Bakery, Pantry, Frozen, Deli, y categorías custom).
- **Product cards:** emoji icon + nombre + badge de categoría (con color) + precio + zona de temperatura + stock actual.
- **Sort By dropdown:** orden alfabético A→Z o Z→A.
- **Category dropdown:** filtro secundario combinable con el sidebar.
- **Add a Product button:** formulario para crear producto custom directamente desde la UI.

### Tab: Basket

- **Item rows:** nombre del producto + precio unitario + stock disponible + stepper (− / +) + botón REMOVE.
- **Subtotal:** subtotal por ítem en color accent (ej: `Subtotal: $19.50` para qty 3 × $6.50).
- **REFRESH:** re-fetch del estado de la cesta sin recargar la página.
- **CLEAR ALL:** vacía toda la cesta en una sola acción.
- **Order Summary panel (derecha):** total de ítems + total del pedido + botón verde **PLACE ORDER**.
- **Empty state:** icono de carrito + mensaje `"Your basket is empty. Start marketing!"`

### Tab: Orders

- **Order cards:** número de pedido (ej: `O40699`) + timestamp + total en color accent + status badge.
- **Status badges:** `PENDING` = amarillo · `DELIVERED` = verde · `CANCELLED` = rojo.
- **Items section (expandida):** cada ítem como `Nombre × qty — $subtotal`.
- **Status dropdown:** cambiar el estado del pedido directamente (dispara `PUT /api/orders/:id`).
- **DELETE ORDER:** borra el registro del pedido permanentemente.

### Top Navigation Bar

| Elemento | Acción |
|---|---|
| **Reset** | `POST /api/reset` — limpia y re-seed el catálogo de productos |
| **Username badge** | Muestra el usuario logueado |
| **API Docs** | Link a `/market/docs` (Swagger) |
| **Data Viewer** | Link a `/market-viewer.html` |
| **Profile** | Link a la página de cuenta |

---

## 6. Flujos de la Aplicación

### 6.1 Products Flow

```
1. POST /api/reset          → Estado determinista (25-30 productos seed)
2. GET  /api/groceries      → Listar todos los productos
   GET  /api/groceries/filter?category=Dairy,Meat&sort=desc  → Filtrar
3. POST /api/groceries      → Crear producto (required: product_name, price, category)
4. PUT  /api/groceries/:id  → Actualizar (partial update — solo los campos enviados)
5. DELETE /api/groceries/:id → Borrar (CASCADE elimina de la cesta automáticamente)
```

### 6.2 Basket Flow

```
1. POST /api/basket         → Añadir ítem (verifica stock; fusiona si ya existe)
2. GET  /api/basket         → Ver cesta (con detalles del producto y precio actual)
3. PUT  /api/basket         → Actualizar cantidad por product_id (valor absoluto, no aditivo)
4. DELETE /api/basket/:id   → Quitar un producto de la cesta
5. DELETE /api/basket/clear → Vaciar toda la cesta
```

### 6.3 Order Flow

```
1. [Cesta con ítems]        → Requisito previo
2. POST /api/orders         → Colocar pedido:
   - Snapshot: product_name, category, price, temperature_zone → order_items
   - Total calculado server-side
   - Cesta se vacía automáticamente
   - Stock decrementado por ítem
   ⚠️ IRREVERSIBLE para el stock — no se restaura al cancelar
3. GET  /api/orders         → Ver todos los pedidos
   GET  /api/orders/:id     → Ver pedido específico
4. PUT  /api/orders/:id     → Cambiar status o notes
   Valid statuses: pending · processing · shipped · delivered · cancelled
```

---

## 7. Referencia de Endpoints API

> **Autenticación:** Todos los endpoints requieren `Authorization: qac_live_...`

### 7.1 Products

| Método | Endpoint | Descripción | Respuesta OK |
|---|---|---|---|
| `GET` | `/api/groceries` | Listar todos los productos | 200 |
| `GET` | `/api/groceries/filter` | Filtrar productos (ver params abajo) | 200 |
| `POST` | `/api/groceries` | Crear producto | 201 |
| `PUT` | `/api/groceries/:id` | Actualizar producto (partial update) | 200 |
| `DELETE` | `/api/groceries/:id` | Borrar producto (cascade a basket) | 200 |
| `POST` | `/api/reset` | Resetear catálogo al estado seed | 200 |

**Query params de `/api/groceries/filter`:**

```
category=Dairy                    # una categoría
category=Dairy,Meat               # múltiples categorías (comma-separated)
temperature_zone=Chilled          # Dry | Frozen | Chilled | Room Temperature
weighted=true                     # boolean
sort=asc                          # asc (default) | desc
```

**Body de `POST /api/groceries`:**

```json
{
  "product_name": "Cheddar Cheese",   // required
  "price": 4.99,                       // required, positive number
  "category": "Dairy",                 // required
  "temperature_zone": "Chilled",       // optional
  "weighted": false,                   // optional, default false
  "stock": 50,                         // optional, default 0
  "details": {                         // optional JSONB
    "brand": "Vintage Gold",
    "weight": "400g"
  }
}
```

**Errores comunes — Products:**

| Código | Causa |
|---|---|
| 400 | Campos requeridos faltantes o `temperature_zone` inválida |
| 401 | API key inválida |
| 404 | Producto no encontrado o pertenece a otro usuario |

### 7.2 Basket

| Método | Endpoint | Descripción | Respuesta OK |
|---|---|---|---|
| `POST` | `/api/basket` | Añadir ítem (`product_id`, `quantity`) | 201 |
| `GET` | `/api/basket` | Ver cesta completa | 200 |
| `PUT` | `/api/basket` | Actualizar cantidad (`product_id`, `quantity`) | 200 |
| `DELETE` | `/api/basket/:product_id` | Quitar un producto | 200 |
| `DELETE` | `/api/basket/clear` | Vaciar toda la cesta | 200 |

**Errores comunes — Basket:**

| Código | Causa |
|---|---|
| 400 | `quantity < 1` |
| 400 | Stock insuficiente: `"Not enough stock. Available: 5"` |
| 400 | Stock insuficiente considerando cesta actual: `"Not enough stock. Available: 5, Already in basket: 3"` |
| 404 | Producto no encontrado |

### 7.3 Orders

| Método | Endpoint | Descripción | Respuesta OK |
|---|---|---|---|
| `POST` | `/api/orders` | Colocar pedido (body opcional: `notes`) | 201 |
| `GET` | `/api/orders` | Listar todos los pedidos | 200 |
| `GET` | `/api/orders/:id` | Ver pedido específico | 200 |
| `PUT` | `/api/orders/:id` | Actualizar status o notes | 200 |
| `DELETE` | `/api/orders/:id` | Borrar pedido | 200 |

**Errores comunes — Orders:**

| Código | Causa |
|---|---|
| 400 | Cesta vacía al intentar colocar pedido |
| 400 | Status inválido (ej: `"returned"`) |

### 7.4 Reset

```
POST /api/reset
Authorization: qac_live_...
(sin body)

→ 200  { "message": "Data reset successfully", "count": 28 }
```

> ⚠️ El reset **solo afecta a Products**. Basket y Orders **no se ven afectados**.

---

## 8. Test Cases — API

### Products

| ID | Descripción | Tipo | Input | Expected |
|---|---|---|---|---|
| TC-PROD-001 | GET all products después del registro | Positive | — | 200 · array length ≥ 1 |
| TC-PROD-002 | Crear producto con todos los campos opcionales | Positive | Todos los campos | 201 · todos los campos en respuesta |
| TC-PROD-003 | Crear producto con `temperature_zone` inválida | Negative | `temperature_zone="Warm"` | 400 |
| TC-PROD-004 | Filtrar por múltiples categorías (comma-separated) | Positive | `?category=Dairy,Meat` | 200 · solo Dairy y Meat |
| TC-PROD-005 | API key inválida devuelve 401 | Security | `Authorization: invalid-key` | 401 |
| TC-PROD-006 | GET producto de otro usuario devuelve 404 | Security | UUID de User A, auth de User B | 404 (data isolation) |
| TC-PROD-007 | Actualización parcial solo cambia el precio | Edge | `PUT { "price": 9.99 }` | 200 · solo price cambió |

### Basket

| ID | Descripción | Tipo | Input | Expected |
|---|---|---|---|---|
| TC-BASK-001 | Añadir producto a la cesta | Positive | qty=2 | 201 · quantity=2 |
| TC-BASK-002 | Añadir el mismo producto dos veces fusiona cantidades | Edge | +2 luego +3 mismo producto | 200 · quantity=5, una sola fila |
| TC-BASK-003 | Añadir más que el stock disponible | Negative | stock=5, qty=6 | 400 · `"Not enough stock. Available: 5"` |
| TC-BASK-004 | Stock check considera cantidad ya en cesta | Edge | stock=5, basket=3, add=3 | 400 · `"...Already in basket: 3"` |
| TC-BASK-005 | Añadir ítem con cantidad 0 | Negative | qty=0 | 400 · `"quantity must be at least 1"` |
| TC-BASK-006 | Borrar producto hace cascade desde cesta | Edge | Add → Delete product → GET basket | 200 · basket vacía |

### Orders

| ID | Descripción | Tipo | Input | Expected |
|---|---|---|---|---|
| TC-ORD-001 | Colocar pedido con ítems en cesta | Positive | Cesta con ítems | 201 · `order_number` ~ `/^O\d{5}$/` · basket vacía |
| TC-ORD-002 | Colocar pedido con cesta vacía | Negative | Cesta vacía | 400 · `"Basket is empty"` |
| TC-ORD-003 | Total del pedido coincide con suma de ítems | Positive | Precios conocidos | `total_amount` coincide (2 decimales) |
| TC-ORD-004 | `price_at_purchase` no cambia al actualizar el producto | Edge | Place order → update price → fetch order | `price_at_purchase` inalterado |
| TC-ORD-005 | Stock decrementado tras colocar pedido | Positive | Stock inicial N, buy M | Nuevo stock = N − M |
| TC-ORD-006 | Status inválido en actualización | Negative | `{ "status": "returned" }` | 400 |
| TC-ORD-007 | Formato del número de pedido | Edge | Cualquier pedido | `order_number` ~ `/^O\d{5}$/` |

---

## 9. Test Cases — UI

> Target: navegador en `/market/<username>`. Usar Chrome, Firefox o Safari.

### Stats Dashboard

| ID | Descripción | Tipo | Steps | Expected |
|---|---|---|---|---|
| TC-UI-001 | Basket Items incrementa al añadir producto | Positive | Notar stat → añadir qty=3 | Counter +3 |
| TC-UI-002 | Stats actualizan tras PLACE ORDER | Positive | Orders=0, Basket=N → PLACE ORDER | Orders=1; Basket Items=0 |
| TC-UI-003 | Total Value no cambia al vaciar la cesta | Edge | Grabar Total Value → CLEAR ALL | Total Value inalterado |

### Products Tab

| ID | Descripción | Tipo | Steps | Expected |
|---|---|---|---|---|
| TC-UI-004 | Filtro sidebar muestra solo la categoría | Positive | Click "Dairy" | Solo cards con badge "Dairy" |
| TC-UI-005 | Sort Z→A invierte el grid | Positive | Notar orden A→Z → cambiar a Z→A | Primera card = última alfabéticamente |
| TC-UI-006 | Cada product card muestra todos los campos | Positive | Inspeccionar cards | Emoji + nombre + badge + precio + temp zone + stock |
| TC-UI-007 | Reset (top nav) restaura productos borrados | Positive | Borrar producto → click Reset | Producto reaparece; contador al valor seed |

### Basket Tab

| ID | Descripción | Tipo | Steps | Expected |
|---|---|---|---|---|
| TC-UI-008 | Stepper actualiza subtotal en tiempo real | Positive | OJ×3 ($6.50) → click + | Subtotal $19.50 → $26.00; Order Summary actualiza |
| TC-UI-009 | Empty state muestra mensaje correcto | Positive | PLACE ORDER o CLEAR ALL → Basket tab | Icono carrito + `"Your basket is empty. Start marketing!"` |
| TC-UI-010 | REMOVE quita solo ese producto | Positive | 2 productos → REMOVE en uno | Solo el clickado desaparece |
| TC-UI-011 | PLACE ORDER no disponible con cesta vacía | Edge | Basket tab sin ítems | Botón ausente o disabled |
| TC-UI-012 | Total en Order Summary = suma de subtotales | Positive | Múltiples productos y cantidades | Total = Σ(precio × qty) |

### Orders Tab

| ID | Descripción | Tipo | Steps | Expected |
|---|---|---|---|---|
| TC-UI-013 | Número de pedido tiene formato O##### | Positive | Colocar cualquier pedido | Exactamente 6 chars: O + 5 dígitos |
| TC-UI-014 | Color del badge según status | Positive | PENDING → DELIVERED → CANCELLED | Amarillo → Verde → Rojo |
| TC-UI-015 | Items muestran nombre, qty y subtotal | Positive | OJ × 3 a $6.50 | `100% Florida Orange Juice × 3 — $19.50` |
| TC-UI-016 | Timestamp del pedido es aproximadamente el hora actual | Positive | Notar hora → PLACE ORDER | Timestamp coincide en pocos segundos |
| TC-UI-017 | DELETE ORDER borra y decrementa counter | Negative | Orders=1 → DELETE ORDER | Desaparece de la lista; Orders=0 |
| TC-UI-018 | Cesta vacía automáticamente tras PLACE ORDER | Positive | Add items → PLACE ORDER → Basket tab | Empty state; Basket Items=0 |

---

## 10. QA Tasks (Hands-On)

### Task 1 — The Full Shopping Journey *(Beginner · ~20 min · Manual)*

Flow completo manual con REST client (Postman, Insomnia, o curl):

1. Registrar cuenta y capturar `api_key`
2. Listar productos y encontrar 3 categorías distintas
3. Añadir 2 productos distintos a la cesta
4. Verificar GET /api/basket muestra exactamente esos 2 ítems
5. Colocar pedido y guardar `order_number`
6. Verificar que la cesta está vacía tras el pedido
7. Verificar que el stock del producto disminuyó en la cantidad comprada
8. Actualizar el status del pedido a `delivered`

### Task 2 — Break the Stock System *(Intermediate · ~25 min · Manual)*

Explorar todos los caminos de validación de stock:

1. Encontrar producto con stock=0 e intentar añadirlo a la cesta
2. Stock=5, añadir 3, intentar añadir 3 más
3. Añadir la cantidad exacta del stock — verificar que lo permite
4. Añadir stock+1 — verificar que el mensaje de error es útil
5. Colocar pedido, luego intentar añadir la misma cantidad que debería estar agotada
6. Crear producto con stock=0 y verificar que aparece pero no se puede añadir

### Task 3 — Data Isolation Audit *(Intermediate · ~30 min · Security)*

Verificar aislamiento de datos entre usuarios:

1. Registrar dos cuentas — capturar ambas API keys
2. Crear productos con User A — verificar que User B no los ve
3. Usar API key de User B para GET del ID de producto de User A — esperar 404
4. Intentar actualizar/borrar producto de User A con API key de User B — esperar 404
5. Añadir ítems a cesta de User A — verificar que cesta de User B está vacía
6. Colocar pedido como User A — verificar que no aparece en pedidos de User B

### Task 4 — Filter & Sort Validation *(Intermediate · ~30 min · Manual + Auto)*

Tests exhaustivos del endpoint de filtrado:

1. Filtrar por cada `temperature_zone` y verificar solo productos correctos
2. Filtrar con `temperature_zone` inválida — esperar 400
3. `weighted=true` — todos los productos devueltos deben tener weighted=true
4. Combinar filtros `category` + `temperature_zone`
5. Múltiples categorías: `category=Dairy,Meat`
6. `sort=asc` — verificar orden alfabético A→Z
7. `sort=desc` — verificar orden inverso Z→A
8. Filtrar por categoría inexistente — esperar array vacío, no error

### Task 5 — Automate the Happy Path *(Intermediate · ~45 min · Playwright/Python/JS)*

Script automatizado del flujo positivo completo:

1. Generar credenciales únicas (ej: username basado en timestamp)
2. Registrar y extraer `api_key` de la respuesta
3. GET productos y seleccionar el primero con stock > 0
4. Añadir 1 unidad a la cesta y verificar respuesta 201
5. GET basket y verificar que item count = 1
6. POST /api/orders y verificar que `order_number` ~ `/^O\d{5}$/`
7. Verificar que `total_amount` = precio del producto × cantidad
8. Verificar que la cesta está vacía tras el pedido

### Task 6 — CRUD Product Automation Suite *(Advanced · ~60 min · Jest/Pytest/Mocha)*

Suite completa de CRUD con casos positivos y negativos:

- Setup: registrar y resetear datos antes de la suite
- POST solo con campos requeridos → 201
- POST con todos los campos incluyendo JSONB `details` → 201
- POST sin `product_name` → 400
- POST con `temperature_zone` inválida → 400
- PUT partial update: solo cambiar precio → otros campos inalterados
- DELETE → producto desaparece del GET all
- DELETE ID inexistente → 404
- GET con API key inválida → 401
- Teardown: POST /api/reset

### Task 7 — Stress Test the Basket *(Intermediate · ~45 min · Any HTTP client)*

Edge cases de la cesta: merge de cantidades, límites de stock, adiciones concurrentes:

- Añadir producto A (qty=2), añadir mismo (qty=3) → basket qty=5
- Añadir con qty=0 → 400
- Añadir con qty=-1 → 400
- Añadir qty > stock → 400 con mensaje útil
- Añadir qty = stock exacto → 201
- Añadir stock+1 cuando ítem ya está en cesta → 400
- Clear basket → GET basket → array vacío
- Remove producto específico → solo ese producto desaparece

### Task 8 — Price Snapshot Integrity *(Advanced · ~40 min · Data integrity)*

Verificar que `price_at_purchase` es inmutable:

1. Crear producto con price=10.00
2. Añadirlo a la cesta y colocar pedido — guardar `price_at_purchase`
3. Actualizar precio del producto a 99.99
4. Fetch del pedido — verificar que `price_at_purchase` sigue siendo 10.00
5. Borrar el producto completamente
6. Fetch del pedido — verificar que los ítems del pedido siguen mostrando los datos del producto
7. Automatizar como test de regresión

### Task 9 — Auth Security Testing *(Advanced · ~30 min · Security)*

Sondear el sistema de autenticación para vulnerabilidades comunes:

1. Registrar con SQL injection en username: `admin'; DROP TABLE users;--`
2. XSS en campo username: `<script>alert(1)</script>`
3. Brute-force: 10 intentos de login incorrectos — verificar comportamiento del sistema
4. Acceder a `GET /api/profile` sin auth → 401
5. Modificar el payload del JWT (decode, cambiar userId, re-encode) → 401
6. JWT expirado si es posible → 401
7. Registrar con password vacío `""`

### Task 10 — Build a Postman Collection *(Intermediate-Advanced · ~60 min · Postman)*

Colección completa y compartible con variables, pre-request scripts y test assertions:

1. Variables de entorno: `base_url`, `api_key`, `product_id`, `order_id`
2. Request de registro con test script para extraer y guardar `api_key`
3. Pre-request script que llama a `POST /api/reset` antes de tests de productos
4. Test assertions de status codes en cada request
5. Test assertions de forma del body (campos requeridos presentes)
6. Requests encadenados: crear producto → guardar ID → usar en cesta → colocar pedido → guardar order ID
7. Carpeta de tests negativos con escenarios de error esperados
8. Exportar colección y documentar cómo importar y ejecutar

---

## 📎 Notas de Implementación para el Proyecto

### Consideraciones para `playwright.config.ts`

```typescript
// Base URL específica para Market
baseURL: process.env.QACLOUD_BASE_URL + '/market'

// Timeout recomendado para stock validation (puede ser lento)
timeout: 30000
```

### Headers de autenticación

```typescript
// Todas las requests API de Market necesitan:
headers: {
  'Authorization': process.env.QACLOUD_API_KEY
}
```

### Estrategia de reset en tests

```typescript
// En beforeAll o beforeEach de suites destructivas:
await request.post('/api/reset', { headers: authHeaders });
// ⚠️ El reset NO afecta a Basket ni Orders, solo a Products
```

### Regex de validación de order number

```typescript
// Usar en assertions:
expect(order.order_number).toMatch(/^O\d{5}$/)
```

### Mapa de status codes esperados

```
Products:  201 (create) | 200 (read/update/delete) | 400 (invalid) | 401 (auth) | 404 (not found)
Basket:    201 (add)    | 200 (read/update/delete) | 400 (stock/qty) | 404 (product)
Orders:    201 (place)  | 200 (read/update/delete) | 400 (empty basket / invalid status)
Reset:     200
```

---

*Documento generado desde `https://www.qacloud.dev/market/wiki`*  
*Versión: 1.0.0 · Para uso interno del proyecto `qacloud-qa-project`*
