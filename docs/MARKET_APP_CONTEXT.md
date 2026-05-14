# Market App — QA Context

> **App URL:** `https://www.qacloud.dev/market/<username>`
> **Swagger UI:** `https://www.qacloud.dev/market/docs`
> **Wiki:** `https://www.qacloud.dev/market/wiki`
> **Data Viewer:** `https://www.qacloud.dev/market-viewer.html`

This document covers everything a QA engineer needs to understand and test the Market application: domain logic, API reference, UI behavior, test case catalogue, and hands-on tasks.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Key QA Characteristics](#2-key-qa-characteristics)
3. [Product Catalogue — Seed Data](#3-product-catalogue--seed-data)
4. [UI Overview](#4-ui-overview)
5. [Application Flows](#5-application-flows)
6. [API Reference](#6-api-reference)
7. [Test Cases — API](#7-test-cases--api)
8. [Test Cases — UI](#8-test-cases--ui)
9. [QA Tasks — Hands-On](#9-qa-tasks--hands-on)

---

## 1. Application Overview

The **Market Application** is a REST e-commerce API that simulates a real online supermarket. It is the most complete application on the qacloud platform and the primary focus of this automation project.

Each user gets their own **fully isolated data environment**: a personal catalogue pre-seeded with supermarket items, an empty basket, and an empty order history. Data never leaks between users, making it safe to run destructive tests (delete, reset) without coordination.

### Data Architecture

```
User (api_key)
 ├── Products  (personal catalogue — ~25–30 items by default)
 ├── Basket    (active basket — items with quantity)
 └── Orders    (order history — items with price snapshot)
```

---

## 2. Key QA Characteristics

These features are specifically designed for bug detection practice and advanced testing patterns:

| Feature | Behavior | QA Relevance |
|---------|----------|--------------|
| **Stock validation** | Adding more units than available stock returns an error | Edge cases, error messages |
| **Price snapshot** | `price_at_purchase` is fixed at order time and never changes even if the product is updated | Data integrity testing |
| **Basket accumulation** | Adding the same product twice **merges** quantities — no duplicate rows | Merge logic, race conditions |
| **Order number format** | `O` + 5 random digits (e.g. `O40699`) | Regex validation |
| **Data isolation** | Using another user's API key returns empty data, not an error | Security testing |
| **Filter API** | Multi-value category filter, boolean weighted filter, sort order | Parameter combinatorics |
| **Reset endpoint** | `POST /api/reset` restores the catalogue to its default seed state | Deterministic test setup |
| **Cascade delete** | Deleting a product automatically removes it from the basket | Referential integrity |
| **Stock not restored** | Cancelling or deleting an order does **not** restore stock — intentional | Bug hunting, business logic |

---

## 3. Product Catalogue — Seed Data

On registration, each user receives **25–30 pre-seeded products** distributed across 8 categories:

| Category | Example Products | Typical Temperature Zone |
|----------|-----------------|--------------------------|
| **Dairy** | Milk, Yogurt, Cheese, Butter | Chilled |
| **Bakery** | Bread, Croissants, Rolls | Dry / Room Temperature |
| **Meat** | Chicken, Beef, Pork | Chilled / Frozen |
| **Produce** | Apples, Tomatoes, Carrots | Chilled / Room Temperature |
| **Beverages** | Orange Juice, Sparkling Water | Chilled / Dry |
| **Frozen** | Ice Cream, Frozen Pizza | Frozen |
| **Deli** | Ham, Salami, Hummus | Chilled |
| **Pantry** | Pasta, Rice, Canned Beans | Dry |

**Valid temperature zones:** `Dry` · `Frozen` · `Chilled` · `Room Temperature`

---

## 4. UI Overview

The application UI lives at `/market/<username>` and has **3 tabs** plus a persistent stats dashboard.

### Stats Dashboard (persistent header)

| Counter | What it shows | When it updates |
|---------|--------------|-----------------|
| **Products** | Total products in the catalogue | After creating or deleting a product |
| **Basket Items** | Total quantity of all items in the basket | After adding, removing, or placing an order |
| **Orders** | Total orders placed | After placing or deleting an order |
| **Total Value** | Sum of (price × stock) for the **entire catalogue** | After changing price or stock of any product |

> ⚠️ **Total Value** is the monetary value of the full inventory — not the basket total or order total.

### Tab: Products

- **Left sidebar:** category filters (All Products, Dairy, Produce, Beverages, Meat, Bakery, Pantry, Frozen, Deli, and custom categories).
- **Product cards:** emoji icon + name + category badge (with colour) + price + temperature zone + current stock.
- **Sort By dropdown:** alphabetical A→Z or Z→A.
- **Category dropdown:** secondary filter, combinable with the sidebar.
- **Add a Product button:** form to create a custom product directly from the UI.

### Tab: Basket

- **Item rows:** product name + unit price + available stock + quantity stepper (− / +) + REMOVE button.
- **Subtotal:** per-item subtotal in accent colour (e.g. `Subtotal: $19.50` for qty 3 × $6.50).
- **REFRESH:** re-fetches basket state without reloading the page.
- **CLEAR ALL:** empties the entire basket in one action.
- **Order Summary panel (right):** total items + order total + green **PLACE ORDER** button.
- **Empty state:** cart icon + `"Your basket is empty. Start marketing!"`

### Tab: Orders

- **Order cards:** order number (e.g. `O40699`) + timestamp + total in accent colour + status badge.
- **Status badges:** `PENDING` = yellow · `DELIVERED` = green · `CANCELLED` = red.
- **Items section (expanded):** each item as `Name × qty — $subtotal`.
- **Status dropdown:** update the order status directly (triggers `PUT /api/orders/:id`).
- **DELETE ORDER:** permanently removes the order record.

### Top Navigation Bar

| Element | Action |
|---------|--------|
| **Reset** | `POST /api/reset` — clears and re-seeds the product catalogue |
| **Username badge** | Shows the logged-in user |
| **API Docs** | Link to `/market/docs` (Swagger) |
| **Data Viewer** | Link to `/market-viewer.html` |
| **Profile** | Link to the account page |

---

## 5. Application Flows

### 5.1 Products Flow

```
1. POST /api/reset            → Deterministic state (25–30 seed products)
2. GET  /api/groceries        → List all products
   GET  /api/groceries/filter?category=Dairy,Meat&sort=desc  → Filter
3. POST /api/groceries        → Create product (required: product_name, price, category)
4. PUT  /api/groceries/:id    → Update (partial update — only sent fields change)
5. DELETE /api/groceries/:id  → Delete (CASCADE removes from basket automatically)
```

### 5.2 Basket Flow

```
1. POST /api/basket           → Add item (validates stock; merges if product already exists)
2. GET  /api/basket           → View basket (with product details and current price)
3. PUT  /api/basket           → Update quantity by product_id (absolute value, not additive)
4. DELETE /api/basket/:id     → Remove a single product from the basket
5. DELETE /api/basket/clear   → Empty the entire basket
```

### 5.3 Order Flow

```
1. [Basket with items]        → Required precondition
2. POST /api/orders           → Place order:
   - Snapshot: product_name, category, price, temperature_zone → order_items
   - Total calculated server-side
   - Basket cleared automatically
   - Stock decremented per item
   ⚠️ IRREVERSIBLE for stock — not restored on cancel or delete
3. GET  /api/orders           → List all orders
   GET  /api/orders/:id       → Get specific order
4. PUT  /api/orders/:id       → Update status or notes
   Valid statuses: pending · processing · shipped · delivered · cancelled
```

---

## 6. API Reference

> **Authentication:** all endpoints require `Authorization: qac_live_...`

### 6.1 Products

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `GET` | `/api/groceries` | List all products | 200 |
| `GET` | `/api/groceries/filter` | Filter products (see params below) | 200 |
| `POST` | `/api/groceries` | Create product | 201 |
| `PUT` | `/api/groceries/:id` | Update product (partial) | 200 |
| `DELETE` | `/api/groceries/:id` | Delete product (cascade to basket) | 200 |
| `POST` | `/api/reset` | Reset catalogue to seed state | 200 |

**Query params for `/api/groceries/filter`:**

```
category=Dairy                        one category
category=Dairy,Meat                   multiple categories (comma-separated)
temperature_zone=Chilled              Dry | Frozen | Chilled | Room Temperature
weighted=true                         boolean filter
sort=asc                              asc (default) | desc
```

**Request body — `POST /api/groceries`:**

```json
{
  "product_name": "Cheddar Cheese",   // required
  "price": 4.99,                      // required — positive number
  "category": "Dairy",                // required
  "temperature_zone": "Chilled",      // optional
  "weighted": false,                  // optional — default false
  "stock": 50,                        // optional — default 0
  "details": {                        // optional JSONB
    "brand": "Vintage Gold",
    "weight": "400g"
  }
}
```

**Error codes — Products:**

| Code | Cause |
|------|-------|
| 400 | Missing required fields or invalid `temperature_zone` |
| 401 | Invalid API key |
| 404 | Product not found or belongs to another user |

### 6.2 Basket

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `POST` | `/api/basket` | Add item (`product_id`, `quantity`) | 201 |
| `GET` | `/api/basket` | View full basket | 200 |
| `PUT` | `/api/basket` | Update quantity (`product_id`, `quantity`) | 200 |
| `DELETE` | `/api/basket/:product_id` | Remove a product | 200 |
| `DELETE` | `/api/basket/clear` | Empty the basket | 200 |

**Error codes — Basket:**

| Code | Cause |
|------|-------|
| 400 | `quantity < 1` |
| 400 | Insufficient stock: `"Not enough stock. Available: 5"` |
| 400 | Insufficient stock considering basket: `"Not enough stock. Available: 5, Already in basket: 3"` |
| 404 | Product not found |

### 6.3 Orders

| Method | Endpoint | Description | Success |
|--------|----------|-------------|---------|
| `POST` | `/api/orders` | Place order (optional body: `notes`) | 201 |
| `GET` | `/api/orders` | List all orders | 200 |
| `GET` | `/api/orders/:id` | Get specific order | 200 |
| `PUT` | `/api/orders/:id` | Update status or notes | 200 |
| `DELETE` | `/api/orders/:id` | Delete order | 200 |

**Error codes — Orders:**

| Code | Cause |
|------|-------|
| 400 | Empty basket when placing order |
| 400 | Invalid status (e.g. `"returned"`) |

### 6.4 Reset

```
POST /api/reset
Authorization: qac_live_...
(no body)

→ 200  { "message": "Data reset successfully", "count": 28 }
```

> ⚠️ Reset affects **Products only**. Basket and Orders are not affected.

---

## 7. Test Cases — API

### Products

| ID | Description | Type | Input | Expected |
|----|-------------|------|-------|----------|
| TC-PROD-001 | GET all products after registration | Positive | — | 200 · array length ≥ 1 |
| TC-PROD-002 | Create product with all optional fields | Positive | All fields | 201 · all fields present in response |
| TC-PROD-003 | Create product with invalid `temperature_zone` | Negative | `temperature_zone="Warm"` | 400 |
| TC-PROD-004 | Filter by multiple categories (comma-separated) | Positive | `?category=Dairy,Meat` | 200 · only Dairy and Meat |
| TC-PROD-005 | Invalid API key returns 401 | Security | `Authorization: invalid-key` | 401 |
| TC-PROD-006 | GET product from another user returns 404 | Security | UUID from User A, auth from User B | 404 (data isolation) |
| TC-PROD-007 | Partial update changes only the price | Edge | `PUT { "price": 9.99 }` | 200 · only price changed |

### Basket

| ID | Description | Type | Input | Expected |
|----|-------------|------|-------|----------|
| TC-BASK-001 | Add product to basket | Positive | qty=2 | 201 · quantity=2 |
| TC-BASK-002 | Adding the same product twice merges quantities | Edge | +2 then +3 same product | 200 · quantity=5, single row |
| TC-BASK-003 | Add more than available stock | Negative | stock=5, qty=6 | 400 · `"Not enough stock. Available: 5"` |
| TC-BASK-004 | Stock check accounts for quantity already in basket | Edge | stock=5, basket=3, add=3 | 400 · `"...Already in basket: 3"` |
| TC-BASK-005 | Add item with quantity 0 | Negative | qty=0 | 400 · `"quantity must be at least 1"` |
| TC-BASK-006 | Deleting a product cascades to basket | Edge | Add → Delete product → GET basket | 200 · basket empty |

### Orders

| ID | Description | Type | Input | Expected |
|----|-------------|------|-------|----------|
| TC-ORD-001 | Place order with items in basket | Positive | Basket with items | 201 · `order_number` matches `/^O\d{5}$/` · basket empty |
| TC-ORD-002 | Place order with empty basket | Negative | Empty basket | 400 · `"Basket is empty"` |
| TC-ORD-003 | Order total matches sum of items | Positive | Known prices | `total_amount` correct to 2 decimal places |
| TC-ORD-004 | `price_at_purchase` does not change after product update | Edge | Place order → update price → fetch order | `price_at_purchase` unchanged |
| TC-ORD-005 | Stock decremented after placing order | Positive | Initial stock N, buy M | New stock = N − M |
| TC-ORD-006 | Invalid status on update | Negative | `{ "status": "returned" }` | 400 |
| TC-ORD-007 | Order number format | Edge | Any order | `order_number` matches `/^O\d{5}$/` |

---

## 8. Test Cases — UI

> Target: browser at `/market/<username>`. Supported browsers: Chrome, Firefox, Safari.

### Stats Dashboard

| ID | Description | Type | Steps | Expected |
|----|-------------|------|-------|----------|
| TC-UI-001 | Basket Items counter increments on add | Positive | Note stat → add qty=3 | Counter +3 |
| TC-UI-002 | Stats update after PLACE ORDER | Positive | Orders=0, Basket=N → PLACE ORDER | Orders=1 · Basket Items=0 |
| TC-UI-003 | Total Value does not change after clearing basket | Edge | Record Total Value → CLEAR ALL | Total Value unchanged |

### Products Tab

| ID | Description | Type | Steps | Expected |
|----|-------------|------|-------|----------|
| TC-UI-004 | Sidebar filter shows only selected category | Positive | Click "Dairy" | Only cards with "Dairy" badge |
| TC-UI-005 | Sort Z→A reverses the grid | Positive | Note A→Z order → switch to Z→A | First card = last alphabetically |
| TC-UI-006 | Each product card shows all fields | Positive | Inspect cards | Emoji + name + badge + price + temp zone + stock |
| TC-UI-007 | Reset (top nav) restores deleted products | Positive | Delete product → click Reset | Product reappears · counter back to seed value |

### Basket Tab

| ID | Description | Type | Steps | Expected |
|----|-------------|------|-------|----------|
| TC-UI-008 | Stepper updates subtotal in real time | Positive | OJ×3 ($6.50) → click + | Subtotal $19.50 → $26.00 · Order Summary updates |
| TC-UI-009 | Empty state shows correct message | Positive | PLACE ORDER or CLEAR ALL → Basket tab | Cart icon + `"Your basket is empty. Start marketing!"` |
| TC-UI-010 | REMOVE removes only that product | Positive | 2 products → REMOVE one | Only the clicked one disappears |
| TC-UI-011 | PLACE ORDER unavailable with empty basket | Edge | Basket tab with no items | Button absent or disabled |
| TC-UI-012 | Order Summary total equals sum of subtotals | Positive | Multiple products and quantities | Total = Σ(price × qty) |

### Orders Tab

| ID | Description | Type | Steps | Expected |
|----|-------------|------|-------|----------|
| TC-UI-013 | Order number has format O##### | Positive | Place any order | Exactly 6 chars: O + 5 digits |
| TC-UI-014 | Badge colour reflects status | Positive | PENDING → DELIVERED → CANCELLED | Yellow → Green → Red |
| TC-UI-015 | Items show name, qty and subtotal | Positive | OJ × 3 at $6.50 | `100% Florida Orange Juice × 3 — $19.50` |
| TC-UI-016 | Order timestamp is approximately current time | Positive | Note time → PLACE ORDER | Timestamp matches within a few seconds |
| TC-UI-017 | DELETE ORDER removes it and decrements counter | Negative | Orders=1 → DELETE ORDER | Disappears from list · Orders=0 |
| TC-UI-018 | Basket automatically emptied after PLACE ORDER | Positive | Add items → PLACE ORDER → Basket tab | Empty state · Basket Items=0 |

---

## 9. QA Tasks — Hands-On

> Track your progress by marking completed tasks with `✅`.

### Task 1 — The Full Shopping Journey *(Beginner · ~20 min · Manual)*

Complete manual flow using a REST client (Postman, Insomnia, or curl):

- [ ] Register an account and capture the `api_key`
- [ ] List products and identify 3 different categories
- [ ] Add 2 different products to the basket
- [ ] Verify `GET /api/basket` returns exactly those 2 items
- [ ] Place an order and save the `order_number`
- [ ] Verify the basket is empty after the order
- [ ] Verify product stock decreased by the purchased quantity
- [ ] Update the order status to `delivered`

### Task 2 — Break the Stock System *(Intermediate · ~25 min · Manual)*

Explore all stock validation paths:

- [ ] Find a product with stock=0 and try to add it to the basket
- [ ] stock=5 → add 3 → try to add 3 more
- [ ] Add the exact stock amount — verify it is allowed
- [ ] Add stock+1 — verify the error message is useful
- [ ] Place an order, then try to add the same quantity that should now be out of stock
- [ ] Create a product with stock=0 and verify it appears but cannot be added

### Task 3 — Data Isolation Audit *(Intermediate · ~30 min · Security)*

Verify data isolation between users:

- [ ] Register two accounts — capture both API keys
- [ ] Create products with User A — verify User B cannot see them
- [ ] Use User B's API key to GET a product ID belonging to User A — expect 404
- [ ] Try to update/delete User A's product with User B's API key — expect 404
- [ ] Add items to User A's basket — verify User B's basket is empty
- [ ] Place an order as User A — verify it does not appear in User B's orders

### Task 4 — Filter & Sort Validation *(Intermediate · ~30 min · Manual + Auto)*

Exhaustive testing of the filter endpoint:

- [ ] Filter by each `temperature_zone` and verify only matching products are returned
- [ ] Filter with an invalid `temperature_zone` — expect 400
- [ ] `weighted=true` — all returned products must have weighted=true
- [ ] Combine filters: `category` + `temperature_zone`
- [ ] Multiple categories: `category=Dairy,Meat`
- [ ] `sort=asc` — verify alphabetical A→Z order
- [ ] `sort=desc` — verify reverse Z→A order
- [ ] Filter by non-existent category — expect empty array, not an error

### Task 5 — Automate the Happy Path *(Intermediate · ~45 min · Playwright / Python / JS)*

Automated script for the full positive flow:

- [ ] Generate unique credentials (e.g. timestamp-based username)
- [ ] Register and extract `api_key` from the response
- [ ] GET products and select the first one with stock > 0
- [ ] Add 1 unit to the basket and verify 201 response
- [ ] GET basket and verify item count = 1
- [ ] POST `/api/orders` and verify `order_number` matches `/^O\d{5}$/`
- [ ] Verify `total_amount` = product price × quantity
- [ ] Verify basket is empty after the order

### Task 6 — CRUD Product Automation Suite *(Advanced · ~60 min · Jest / Pytest / Mocha)*

Full CRUD suite with positive and negative cases:

- [ ] Setup: register and reset data before the suite
- [ ] POST with required fields only → 201
- [ ] POST with all fields including JSONB `details` → 201
- [ ] POST without `product_name` → 400
- [ ] POST with invalid `temperature_zone` → 400
- [ ] PUT partial update: change price only → other fields unchanged
- [ ] DELETE → product disappears from GET all
- [ ] DELETE non-existent ID → 404
- [ ] GET with invalid API key → 401
- [ ] Teardown: POST `/api/reset`

### Task 7 — Stress Test the Basket *(Intermediate · ~45 min · Any HTTP client)*

Basket edge cases: quantity merge, stock limits, boundary values:

- [ ] Add product A (qty=2), add same product (qty=3) → basket qty=5
- [ ] Add with qty=0 → 400
- [ ] Add with qty=-1 → 400
- [ ] Add qty > stock → 400 with useful message
- [ ] Add qty = exact stock → 201
- [ ] Add stock+1 when item is already in basket → 400
- [ ] Clear basket → GET basket → empty array
- [ ] Remove specific product → only that product disappears

### Task 8 — Price Snapshot Integrity *(Advanced · ~40 min · Data integrity)*

Verify `price_at_purchase` is immutable:

- [ ] Create product with price=10.00
- [ ] Add to basket and place order — save `price_at_purchase`
- [ ] Update product price to 99.99
- [ ] Fetch the order — verify `price_at_purchase` is still 10.00
- [ ] Delete the product completely
- [ ] Fetch the order — verify order items still show original product data
- [ ] Automate as a regression test

### Task 9 — Auth Security Testing *(Advanced · ~30 min · Security)*

Probe the authentication system for common vulnerabilities:

- [ ] Register with SQL injection in username: `admin'; DROP TABLE users;--`
- [ ] XSS in username field: `<script>alert(1)</script>`
- [ ] Brute-force: 10 incorrect login attempts — observe system behaviour
- [ ] Access `GET /api/profile` without auth → 401
- [ ] Tamper with JWT payload (decode, change userId, re-encode) → 401
- [ ] Use an expired JWT if possible → 401
- [ ] Register with empty password `""`

### Task 10 — Build a Postman Collection *(Intermediate–Advanced · ~60 min · Postman)*

A complete, shareable collection with variables, pre-request scripts, and test assertions:

- [ ] Environment variables: `base_url`, `api_key`, `product_id`, `order_id`
- [ ] Registration request with test script to extract and save `api_key`
- [ ] Pre-request script calling `POST /api/reset` before product tests
- [ ] Status code assertions on every request
- [ ] Body shape assertions (required fields present)
- [ ] Chained requests: create product → save ID → add to basket → place order → save order ID
- [ ] Negative test folder with expected error scenarios
- [ ] Export collection and document how to import and run it

---

## Implementation Notes

### `playwright.config.ts`

```typescript
// Market-specific base URL
baseURL: process.env.QACLOUD_BASE_URL + '/market'

// Recommended timeout — stock validation can be slow
timeout: 30000
```

### Authentication Header

```typescript
// Required on all Market API requests
headers: {
  'Authorization': process.env.QACLOUD_API_KEY
}
```

### Reset Strategy

```typescript
// In beforeAll or beforeEach of destructive suites
await request.post('/api/reset', { headers: authHeaders });
// ⚠️ Reset affects Products only — Basket and Orders are NOT reset
```

### Order Number Validation

```typescript
expect(order.order_number).toMatch(/^O\d{5}$/)
```