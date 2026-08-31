# Crypto Simulator — QA Context

> **App URL:** `https://www.qacloud.dev/crypto.html`
> **Wiki:** `https://www.qacloud.dev/crypto/wiki`
> **REST Base Path:** `/api/crypto`
> **WebSocket URL:** `ws://<host>/ws/crypto`
> **Level:** Intermediate
> **Type:** Real-time WebSocket trading simulator (no Swagger — this app has no REST-only Swagger UI; the wiki is the authoritative reference)

This document covers everything a QA engineer needs to understand and test the Crypto Simulator: domain logic, WebSocket protocol, REST API reference, the QA Control Panel (chaos injection), and a full test case catalogue for Sprint 4 — Advanced Patterns (`QA_PROJECT_ARCHITECTURE.md` §10, Sprint 4: *"Chaos testing — Crypto Simulator (WebSocket)"*).

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Key QA Characteristics](#2-key-qa-characteristics)
3. [Supported Coins — Seed Data](#3-supported-coins--seed-data)
4. [UI Overview](#4-ui-overview)
5. [Application Flows](#5-application-flows)
6. [API Reference](#6-api-reference)
7. [Test Cases — REST API](#7-test-cases--rest-api)
8. [Test Cases — WebSocket / Trading](#8-test-cases--websocket--trading)
9. [Test Cases — Chaos Mode](#9-test-cases--chaos-mode)
10. [QA Tasks — Hands-On](#10-qa-tasks--hands-on)
11. [Known Bug Surfaces (Documented by the Platform)](#11-known-bug-surfaces-documented-by-the-platform)

---

## 1. Application Overview

The **Crypto Simulator** is a real-time, multi-coin trading simulator built around a live **WebSocket price feed** rather than a traditional request/response REST API. This makes it structurally different from Market and Hotel — most of the domain logic (price ticks, trade execution, chaos injection) happens over a persistent WebSocket connection, with only a thin REST layer for reads (`prices`, `profile`) and account-level actions (`inject`, `reset`).

Each user starts with a **fully isolated trading account**:

- **Starting balance:** `$10,000.00 USD`
- **4 tradable coins:** BTC, ETH, SOL, DOGE
- Prices update **every second**, server-side, driven by a market simulation engine that cycles through distinct movement patterns (bull flag, channel up, random walk).
- All trades execute at the **current live price** at the exact moment the WebSocket message is received by the server — there is no client-side price locking, which is itself a source of race-condition test scenarios.

### Data Architecture

```
User (api_key)
 ├── Balance (balance_usd)      — starts at $10,000.00, isolated per user
 ├── Holdings (per coin)        — BTC / ETH / SOL / DOGE quantities
 ├── Orders (trade history)     — last 50 trades, via GET /profile
 └── Price Feed (shared, global)— NOT user-isolated; prices are the same
                                  simulated market for all connected users,
                                  except when a user-triggered /inject call
                                  temporarily biases the direction
```

> ⚠️ **Important distinction from Market/Hotel:** the price feed itself is a **shared global simulation**, not per-user seed data. `POST /api/crypto/reset` resets only the *calling user's* portfolio (balance, holdings, trade history) — it does **not** reset or affect the live price feed, which keeps running continuously for all connected clients. This has direct implications for parallel/CI test execution (see §6.4 and Implementation Notes).

---

## 2. Key QA Characteristics

These features are specifically designed for chaos, concurrency, and precision-bug detection practice:

| Feature | Behavior | QA Relevance |
|---------|----------|---------------|
| **Live shared price feed** | Broadcasts a tick every ~1s for all 4 coins to every connected client | Timing-dependent assertions, flaky-test risk if not handled carefully |
| **Trade-at-receipt-time execution** | A BUY/SELL executes at whatever price is current *when the server processes the message*, not when the client sent it | Race conditions, non-deterministic price in assertions |
| **No client-side price lock** | Nothing prevents the price from moving between "user sees price" and "user submits trade" | Concurrency / rapid-fire testing |
| **Minimum price floor per coin** | The engine will not let any coin's price fall below a hardcoded minimum | Boundary testing on the *down* direction of price injection |
| **QA Control Panel** | UI-accessible chaos controls: latency injection, forced disconnects, malformed payloads, rapid-fire orders, price direction injection | Purpose-built chaos testing surface — this *is* the Sprint 4 deliverable |
| **Negative / non-numeric `amount`** | Documented, deliberate bug surface — the platform explicitly invites testing `amount: -500` and `amount: "five"` | Input validation / type coercion testing |
| **Overspend protection (or lack thereof)** | Buying more than `balance_usd` allows should be rejected — documented as **currently failing** on the platform (see §11) | Negative-path financial validation |
| **Float precision in P&L** | Repeated small-fraction trades (e.g. `0.001 BTC`) accumulate floating-point rounding — the platform explicitly asks whether 10 round trips return exactly the starting capital | Data integrity / precision testing, direct parallel to Market's `price_at_purchase` snapshot testing |
| **Unauthenticated read access** | `GET /prices` intentionally requires **no** API key; `GET /profile`, `POST /inject`, `POST /reset` all require one | Auth boundary testing |
| **Reset is portfolio-only** | `POST /api/crypto/reset` wipes trade history and holdings and resets `balance_usd` to 10000 — it does **not** touch the live price feed | Deterministic *portfolio* state, but **not** deterministic *price* state — plan tests accordingly |

---

## 3. Supported Coins — Seed Data

| Symbol | Name | Approx. Starting Price | Icon |
|--------|------|------------------------|------|
| `BTC` | Bitcoin | ~$45,000 | ₿ |
| `ETH` | Ethereum | ~$2,800 | Ξ |
| `SOL` | Solana | ~$180 | ◎ |
| `DOGE` | Dogecoin | ~$0.18 | Ð |

- Each coin has its own **volatility coefficient** and a **minimum price floor** — the price engine will never let a coin drop below its floor, regardless of injected "down" direction or natural random walk.
- Starting balance on registration (and after every `POST /api/crypto/reset`): **`$10,000.00 USD`**, zero holdings in all 4 coins, empty trade history.

### Price Patterns

The price engine cycles through **three patterns every 50 ticks (~50 seconds)**:

| Pattern | Behavior |
|---------|----------|
| **Bull Flag** | Strong directional move for 25 ticks, followed by a consolidation phase |
| **Channel Up** | Oscillating price with a gradual upward trend, using a sine-wave delta |
| **Random Walk** | Slight bullish bias with random noise — the default baseline pattern |

> When a price injection (`POST /api/crypto/inject`) is active, the normal pattern is temporarily overridden with a strong directional delta toward the injected direction, for the requested duration.

---

## 4. UI Overview

The application lives at `/crypto.html`. Unlike Market and Hotel (tab-based CRUD UIs), the Crypto Simulator UI is built around a **live dashboard** plus the **QA Control Panel**.

### Main Dashboard

- **Live price tiles** — one per coin (BTC, ETH, SOL, DOGE), updating in real time via the WebSocket tick.
- **Portfolio summary** — USD balance, per-coin holdings, total portfolio value, total P&L (mirrors `GET /api/crypto/profile`).
- **Trade panel** — symbol select, amount input, BUY / SELL buttons — sends the WS trade message directly.
- **Trade history** — last 50 trades (from `profile.orders`).

### QA Control Panel

A dedicated panel, purpose-built for chaos testing, exposing these controls:

| Control | Effect | What It Tests |
|---------|--------|----------------|
| **High Latency Mode** | Introduces artificial delay on all WebSocket messages | Client timeout handling, whether trades still execute correctly under delay |
| **Simulate Server Crash** | Abruptly closes the WebSocket connection | Client reconnect logic, whether the UI recovers without a page reload |
| **Send Negative Amount** | Sends `{ action: "BUY", amount: -500 }` | Negative-value input validation |
| **Send String Amount** | Sends `{ action: "BUY", amount: "five" }` | Type validation / coercion |
| **Rapid Fire Orders** | Sends 10 BUY orders in rapid succession | Concurrency / race conditions on balance and holdings |
| **Inject Price Direction** | Forces a coin to trend up or down for 1–60 seconds (also available via `POST /inject`) | Deterministic price movement for assertions, boundary testing on duration |

---

## 5. Application Flows

### 5.1 Connection & Price Feed Flow

```
1. Connect: ws://<host>/ws/crypto?api_key=<key>       → or send key in first message
2. Server → Client: tick every ~1s
   { "type": "tick", "prices": { "BTC": ..., "ETH": ..., "SOL": ..., "DOGE": ... }, "timestamp": ... }
3. [No auth]  GET /api/crypto/prices                  → REST snapshot, no WS connection required
```

> Without a valid API key, price ticks are **still received** — only trade execution requires authentication.

### 5.2 Trading Flow (WebSocket)

```
1. [WS connected + authenticated]
2. Client → Server:  { "action": "BUY" | "SELL", "symbol": "BTC"|"ETH"|"SOL"|"DOGE", "amount": <number> }
3. Server → Client:  { "type": "trade_result", "success": bool, ...trade fields, "balance_usd": ..., "coin_balance": ... }
   - BUY:  deducts (amount × current_price) from balance_usd
   - SELL: adds   (amount × current_price) to balance_usd
   ⚠️ Executes at the price current AT THE MOMENT the server processes the message —
      not the price the client displayed when the user clicked BUY/SELL.
4. GET /api/crypto/profile                            → confirm updated balance/holdings via REST
```

### 5.3 Chaos Injection Flow (REST, account/market-level)

```
1. POST /api/crypto/inject?symbol=BTC&direction=up&duration=15
   → Forces BTC to trend up for 15s (duration capped at 60s server-side — boundary case: test 61s)
2. Monitor WS ticks during the window to verify directional bias
3. After `duration` seconds, price pattern reverts to the normal engine (bull flag / channel up / random walk)
```

### 5.4 Portfolio Reset Flow

```
1. POST /api/crypto/reset
   → Wipes trade history + holdings, resets balance_usd to 10000.00
   ⚠️ Does NOT reset or pause the live price feed — the market keeps moving.
2. GET /api/crypto/profile  → verify balance_usd = 10000, holdings = [], orders = []
```

---

## 6. API Reference

### 6.1 REST Endpoints

> **Authentication:** REST endpoints (except `GET /prices`) require header `x-api-key: <your-key>`.

| Method | Endpoint | Description | Auth Required | Success |
|--------|----------|--------------|:---:|---------|
| `GET` | `/api/crypto/prices` | Current prices for all 4 coins + coin metadata | ❌ No | 200 |
| `GET` | `/api/crypto/profile` | Portfolio snapshot: balance, holdings, P&L, last 50 trades | ✅ Yes | 200 |
| `POST` | `/api/crypto/inject` | Force a coin to trend up/down for N seconds | ✅ Yes | 200 |
| `POST` | `/api/crypto/reset` | Reset the calling user's trading account to the $10,000 initial state | ✅ Yes | 200 |

**Response — `GET /api/crypto/prices`:**

```json
{
  "prices": { "BTC": 46230.50, "ETH": 2847.12, "SOL": 182.44, "DOGE": 0.1923 },
  "coins": {
    "BTC":  { "name": "Bitcoin",  "pair": "BTC/USD",  "icon": "₿" },
    "ETH":  { "name": "Ethereum", "pair": "ETH/USD",  "icon": "Ξ" },
    "SOL":  { "name": "Solana",   "pair": "SOL/USD",  "icon": "◎" },
    "DOGE": { "name": "Dogecoin", "pair": "DOGE/USD", "icon": "Ð" }
  }
}
```

**Response — `GET /api/crypto/profile`:**

```json
{
  "balance_usd": 8576.44,
  "portfolio_value": 11423.56,
  "pnl_total": 1423.56,
  "holdings": [
    { "symbol": "BTC", "balance": 0.02, "price": 46230.50, "value": 924.61, "pnl": 24.61 }
  ],
  "orders": [ /* last 50 trades */ ],
  "total_trades": 7
}
```

**Query params — `POST /api/crypto/inject`:**

| Param | Required | Values | Notes |
|-------|:---:|--------|-------|
| `symbol` | ✅ | `BTC` \| `ETH` \| `SOL` \| `DOGE` | |
| `direction` | ✅ | `up` \| `down` | Cannot force a coin below its price floor |
| `duration` | ❌ | seconds, `1`–`60` | Default `10`. **Boundary case: `61` should be capped to `60`** — confirm actual server behavior, this is untested per the wiki |

**Response — `POST /api/crypto/inject`:**

```json
{
  "symbol": "BTC",
  "direction": "up",
  "duration": 15,
  "message": "BTC will trend up for 15s",
  "endsAt": "2026-04-14T10:00:15.000Z"
}
```

**Response — `POST /api/crypto/reset`:** `200` — no documented response body fields beyond a success indicator; confirm exact shape when writing the API test (see TC-CRY-API-005).

### 6.2 WebSocket Protocol

> ⚠️ **Corrected (confirmed via captured live traffic — see
> `src/api/crypto/crash-diagnostics.spec.ts` output and the malformed
> payload chaos suite's first run).** The wiki documents a single bundled
> `tick` message and a flat `trade_result` response. Neither exists on the
> real server. The table below reflects the CONFIRMED protocol.

| Direction | Message Type | Shape |
|-----------|-------------|-------|
| Server → Client | `init` | One-time, immediately after connecting: `{ "type": "init", "username", "coins": { <symbol>: { symbol, name, pair, startPrice, minPrice, volatility, icon } }, "coinSymbols": [...], "state": { "balance_usd", "balances": {...}, "orders": [] }, "prices": {...}, "history": { <symbol>: [{ "price", "timestamp" }, ...~300 points] } }` |
| Server → Client | `price` | **One message PER coin** (not bundled) — `{ "type": "price", "symbol", "price", "timestamp", "pattern": "bull_flag"\|"channel_up"\|"random", "injected": "up"\|"down"\|null }`, sent roughly every 500ms per coin |
| Client → Server | Trade order | `{ "action": "BUY"\|"SELL", "symbol", "amount": <number> }` — CONFIRMED unchanged from the original doc |
| Server → Client | `order_filled` | Confirms a successful trade — `{ "type": "order_filled", "order": { "id": "TRD-<epoch_ms>", "symbol", "action", "amount", "price", "timestamp", "cost" }, "state": { "balance_usd", "balances": {...} } }`. No `success` boolean — its presence IS success. **The shape of a rejected order (negative/string amount, insufficient funds) is still NOT confirmed** — see §11. |
| Client → Server | QA control | `{ "type": "qa_control", "action": "set_latency"\|"crash", "value": true }` |
| Server → Client | `qa_ack` | Confirms a qa_control action was received — `{ "type": "qa_ack", "action", "value" }`. **CONFIRMED sent for `set_latency`. NOT sent for `crash`** — that action closes the connection directly instead. |

**Authentication:** pass the API key as a query param on connect —
`wss://<host>/ws/crypto?api_key=YOUR_KEY`. Without a valid key, price ticks
are still delivered (confirmed); trade-order behavior without a key is
still not directly confirmed — see TC-CRY-WS-006.

**QA Control Panel action names — confirmed via live probing:**

| Panel button | WS action sent | Confirmed effect |
|---|---|---|
| High Latency (3s delay) | `set_latency` | `qa_ack` received, then ~3s delay before the next `order_filled` |
| 💥 Simulate Server Crash | `crash` | Connection closes immediately, no `qa_ack`. **NOT** `simulate_crash` — that value is silently ignored (no ack, no effect, ticks keep flowing normally) |

**Reconnection:** confirmed automatic — after a `crash`-triggered close, a
fresh connection (same URL/api_key) reconnects successfully in ~2s and
immediately receives a new `init` snapshot followed by `price` ticks.
---

## 7. Test Cases — REST API

| ID | Description | Type | Input | Expected |
|----|-------------|------|-------|----------|
| TC-CRY-API-001 | GET /prices without auth | Positive | No `x-api-key` header | 200 · body contains `prices` and `coins` for all 4 symbols |
| TC-CRY-API-002 | GET /profile without auth | Security | No `x-api-key` header | 401 |
| TC-CRY-API-003 | GET /profile with valid auth | Positive | Valid `x-api-key` | 200 · `balance_usd`, `holdings`, `pnl_total`, `orders`, `total_trades` present |
| TC-CRY-API-004 | GET /profile with invalid key | Security | `x-api-key: invalid` | 401 |
| TC-CRY-API-005 | POST /reset restores initial state | Positive | Prior trades exist → reset | 200 · subsequent `GET /profile` → `balance_usd = 10000.00`, `holdings = []`, `orders = []` |
| TC-CRY-API-006 | POST /reset without auth | Security | No `x-api-key` header | 401 |
| TC-CRY-API-007 | POST /inject with valid params | Positive | `symbol=BTC&direction=up&duration=10` | 200 · response includes `endsAt` ~10s in the future |
| TC-CRY-API-008 | POST /inject without auth | Security | No `x-api-key` header | 401 |
| TC-CRY-API-009 | POST /inject with invalid symbol | Negative | `symbol=XRP` | Expect 400 — **unconfirmed, verify actual behavior** |
| TC-CRY-API-010 | POST /inject with invalid direction | Negative | `direction=sideways` | Expect 400 — **unconfirmed, verify actual behavior** |
| TC-CRY-API-011 | POST /inject duration boundary — exactly 60 | Edge | `duration=60` | 200 · accepted as-is |
| TC-CRY-API-012 | POST /inject duration boundary — 61 (over cap) | Edge | `duration=61` | Per wiki: capped to 60s — **verify actual response, this is documented as untested** |
| TC-CRY-API-013 | POST /inject duration boundary — 0 or negative | Negative | `duration=0`, `duration=-5` | Expect 400 or fallback to default — **unconfirmed, verify actual behavior** |
| TC-CRY-API-014 | Portfolio value calculation accuracy | Positive | Buy multiple coins → `GET /prices` + `GET /profile` concurrently | `portfolio_value` = Σ(`coin_balance` × current `price`) + `balance_usd`, within acceptable float tolerance |

---

## 8. Test Cases — WebSocket / Trading

| ID | Description | Type | Input | Expected |
|----|-------------|------|-------|----------|
| TC-CRY-WS-001 | Connect and receive tick messages | Positive | Valid `api_key` query param | `tick` messages received roughly every 1s, containing all 4 symbols |
| TC-CRY-WS-002 | Connect without api_key still receives ticks | Edge | No `api_key` | Ticks still delivered; trades will fail (see TC-CRY-WS-006) |
| TC-CRY-WS-003 | BUY reduces USD balance correctly | Positive | `GET /profile` (note `balance_usd`) → WS `BUY` 1.0 ETH → `GET /profile` | `new_balance_usd = old_balance_usd − (eth_price_at_execution × 1.0)`, matching the `price` field in `trade_result` |
| TC-CRY-WS-004 | SELL increases USD balance correctly | Positive | Own ≥1.0 ETH → WS `SELL` 1.0 ETH | `balance_usd` increases by `(price_at_execution × 1.0)`; `coin_balance` decreases accordingly |
| TC-CRY-WS-005 | Basket/holding accumulates across multiple buys of the same coin | Edge | BUY 0.5 BTC, then BUY 0.3 BTC | `coin_balance` = 0.8 BTC (single holding entry, not duplicated) |
| TC-CRY-WS-006 | Trade attempt without valid api_key fails | Security | Unauthenticated WS connection → send BUY | `trade_result.success = false` or connection-level rejection — **document actual behavior precisely** |
| TC-CRY-WS-007 | Negative amount BUY is rejected | Negative | `{ "action": "BUY", "symbol": "BTC", "amount": -500 }` | Expected: error response, no trade executed. **Documented by the platform as currently FAILING — confirm and record actual behavior (silent success? crash? wrong balance?)** |
| TC-CRY-WS-008 | String amount BUY is rejected | Negative | `{ "action": "BUY", "symbol": "BTC", "amount": "five" }` | Expected: error response, no trade executed. **Documented by the platform as currently FAILING — confirm and record actual behavior** |
| TC-CRY-WS-009 | Buy amount exceeding balance is rejected | Negative | Calculate max BTC purchasable with $10,000 → attempt 10× that amount | Expected: error indicating insufficient funds. **Documented by the platform as currently FAILING — confirm whether balance goes negative** |
| TC-CRY-WS-010 | Missing `symbol` field | Negative | `{ "action": "BUY", "amount": 1 }` | Expect error response — **unconfirmed, verify actual behavior** |
| TC-CRY-WS-011 | Unknown `action` value | Negative | `{ "action": "HOLD", "symbol": "BTC", "amount": 1 }` | Expect error response, no state change — **unconfirmed, verify actual behavior** |
| TC-CRY-WS-012 | Zero-amount trade | Edge | `{ "action": "BUY", "symbol": "BTC", "amount": 0 }` | Expect rejection (parallel to Market's `quantity < 1` rule) — **unconfirmed, verify actual behavior** |
| TC-CRY-WS-013 | P&L correctness after a round trip | Positive | BUY 1 ETH → wait for price to change → SELL 1 ETH | `GET /profile` → `pnl_total` reflects the actual gain/loss of the round trip, matching `(sell_price − buy_price) × 1.0` |
| TC-CRY-WS-014 | Float precision across many small round trips | Edge / Data Integrity | 10× round trips of `0.001 BTC` (buy then sell) | Verify whether `balance_usd` returns to exactly the pre-trip value, or accumulates floating-point drift — **directly parallels Market's price-snapshot integrity testing (TC-ORD-004)** |

---

## 9. Test Cases — Chaos Mode

> This is the core Sprint 4 deliverable. Each case exercises one QA Control Panel action, either by triggering it through the UI or by sending the equivalent WebSocket/REST message directly (preferred for automation, since it removes UI-timing flakiness from the chaos assertion itself).

| ID | Description | Type | Trigger | Expected |
|----|-------------|------|---------|----------|
| TC-CRY-CHAOS-001 | High Latency Mode delays messages but does not drop/duplicate them | Chaos | WS: `{ "type": "qa_control", "action": "set_latency", "value": true }` | Round-trip time between trade request and `trade_result` increases measurably; trade still executes exactly once, with a correct result |
| TC-CRY-CHAOS-002 | Trade submitted during high latency still resolves correctly | Chaos | Enable latency → send BUY → await `trade_result` | `trade_result` eventually arrives with correct `price`, `cost`, `balance_usd` — no timeout-induced duplicate submission client-side |
| TC-CRY-CHAOS-003 | Simulated server crash closes the connection | Chaos | Trigger "Simulate Server Crash" (UI) or equivalent control message | WS connection closes abruptly (`close` event on the client); no further ticks received on the closed connection |
| TC-CRY-CHAOS-004 | Client reconnects and resumes receiving ticks after a crash | Chaos / E2E | Crash → client reconnect logic (UI) | New WS connection established without a full page reload; ticks resume within a reasonable time window |
| TC-CRY-CHAOS-005 | Rapid Fire Orders — each of 10 concurrent BUYs deducts its own correct cost | Chaos / Concurrency | Trigger "Rapid Fire Orders" or script 10 concurrent WS BUY messages for the same symbol | 10 distinct `trade_result` messages, each with a (possibly different, since price moves) `price`; final `balance_usd` = starting balance − Σ(each trade's individual cost) |
| TC-CRY-CHAOS-006 | Rapid Fire Orders — balance never goes negative | Chaos / Concurrency | Same as above, but sized so that not all 10 orders are affordable | Server rejects the orders that would overdraw the balance; `balance_usd` never goes below `0` |
| TC-CRY-CHAOS-007 | Rapid Fire Orders — no duplicate trade records | Chaos / Concurrency | Same as TC-CRY-CHAOS-005 | `GET /profile.orders` / `total_trades` shows exactly 10 new entries, not more, not fewer |
| TC-CRY-CHAOS-008 | Price injection biases direction as requested | Chaos | `POST /inject?symbol=BTC&direction=up&duration=10` | Recorded BTC prices over the following ~10s trend generally upward (majority of consecutive ticks show `price[n] >= price[n-1]`, allowing for engine noise) |
| TC-CRY-CHAOS-009 | Price injection respects the coin's minimum price floor | Chaos / Boundary | `direction=down` sustained/repeated on the lowest-priced coin (DOGE) | Price never drops below the documented floor, even under forced downward injection |
| TC-CRY-CHAOS-010 | Price injection duration boundary — 60s accepted, 61s capped | Chaos / Boundary | `duration=60` then `duration=61` | `60` → accepted as-is; `61` → response reflects a capped `60` (per wiki) — **confirm actual behavior, flagged as untested by the platform** |
| TC-CRY-CHAOS-011 | Malformed payload matrix — documented server response per case | Chaos / Negative | Each of: negative amount, string amount, missing `symbol`, unknown `action` | Document actual server response for each: structured error / silent no-op / connection drop — this table becomes the authoritative bug report for §11 |

---

## 10. QA Tasks — Hands-On

> Track your progress by marking completed tasks with `✅`. These mirror the platform's own suggested QA tasks for this app, reframed to this project's task format (see `MARKET_APP_CONTEXT.md` §9 for the pattern).

### Task 1 — WebSocket Reconnect Verification *(Intermediate · ~20 min · Manual + Playwright)*

- [ ] Connect to the WS feed and confirm ticks arrive every ~1s
- [ ] Trigger "Simulate Server Crash"
- [ ] Verify the client detects the closed connection
- [ ] Verify the client automatically reconnects without a full page reload
- [ ] Verify ticks resume after reconnect
- [ ] Automate as TC-CRY-CHAOS-003 / 004

### Task 2 — High Latency Impact Measurement *(Intermediate · ~25 min · Playwright / ws client)*

- [ ] Record baseline round-trip time (trade sent → `trade_result` received) under normal conditions
- [ ] Enable High Latency Mode
- [ ] Record round-trip time under latency
- [ ] Verify the trade still executes correctly (correct price, cost, balance) — not dropped, not duplicated
- [ ] Automate as TC-CRY-CHAOS-001 / 002

### Task 3 — Rapid Fire Race Condition Audit *(Advanced · ~40 min · ws client / K6)*

- [ ] Send 10 concurrent BUY orders for the same symbol
- [ ] Capture all 10 `trade_result` messages
- [ ] Verify each has a distinct, individually-correct cost
- [ ] Verify final `balance_usd` matches the sum of individual costs subtracted from the starting balance
- [ ] Verify `total_trades` incremented by exactly 10
- [ ] Automate as TC-CRY-CHAOS-005 / 006 / 007

### Task 4 — Malformed Payload Bug Report *(Advanced · ~30 min · Manual + ws client)*

- [ ] Send `{ action: "BUY", symbol: "BTC", amount: -500 }` — document actual response
- [ ] Send `{ action: "BUY", symbol: "BTC", amount: "five" }` — document actual response
- [ ] Send a BUY with cost far exceeding `balance_usd` — document actual response
- [ ] Send a BUY missing `symbol` — document actual response
- [ ] Send an unknown `action` value — document actual response
- [ ] Write up findings in §11 below, matching the platform's own PASS/FAIL wiki table

### Task 5 — Float Precision Regression Test *(Advanced · ~40 min · Playwright / ws client)*

- [ ] Reset the account
- [ ] Perform 10 round trips of `0.001 BTC` (buy then sell each time)
- [ ] Compare final `balance_usd` to the starting `10000.00`
- [ ] Document any floating-point drift observed
- [ ] Automate as a regression test — direct parallel to Market's Task 8 (Price Snapshot Integrity)

### Task 6 — Price Injection Boundary Testing *(Intermediate · ~30 min · REST client)*

- [ ] Inject `up` and `down` for each of the 4 coins
- [ ] Test `duration=1` (minimum) and `duration=60` (documented maximum)
- [ ] Test `duration=61` — confirm whether the server caps it to 60s as documented
- [ ] Test `duration=0` and negative durations
- [ ] Document actual behavior for each boundary case

### Task 7 — Unauthenticated Access Audit *(Intermediate · ~15 min · REST client)*

- [ ] Confirm `GET /prices` returns 200 with no `x-api-key`
- [ ] Confirm `GET /profile` returns 401 with no `x-api-key`
- [ ] Confirm `POST /inject` returns 401 with no `x-api-key`
- [ ] Confirm `POST /reset` returns 401 with no `x-api-key`
- [ ] Confirm a WS connection without `api_key` still receives ticks but rejects trades

### Task 8 — Portfolio Value Accuracy Audit *(Intermediate · ~25 min · REST + WS client)*

- [ ] Buy at least 2 different coins
- [ ] Query `GET /prices` and `GET /profile` as close together in time as possible
- [ ] Manually compute Σ(`coin_balance` × current `price`) + `balance_usd`
- [ ] Compare to the reported `portfolio_value`
- [ ] Document any discrepancy and an acceptable float tolerance for the automated assertion

---

## 11. Known Bug Surfaces (Documented by the Platform)

The platform's own wiki self-reports the current pass/fail status of its reference test cases. These are **starting hypotheses to confirm and document precisely**, not settled facts — the actual server response (structured error vs. silent no-op vs. crash) for each needs to be captured the first time these are automated, exactly as `HOTEL_APP_CONTEXT.md` §6.4 documents the confirmed Swagger discrepancies for Hotel.

| Behavior | Platform's self-reported status | QA Action Needed |
|----------|-----------------------------------|-------------------|
| Negative `amount` on BUY | FAIL | Confirm actual response shape; document in TC-CRY-WS-007 |
| String `amount` on BUY | FAIL | Confirm actual response shape; document in TC-CRY-WS-008 |
| Buying beyond `balance_usd` | FAIL | Confirm whether balance goes negative or the trade silently succeeds; document in TC-CRY-WS-009 |
| `inject` duration `61` capping to `60` | Untested (no test case provided) | Confirm actual behavior; document in TC-CRY-API-012 / TC-CRY-CHAOS-010 |

> As with Hotel's `PATCH` vs `PUT` and `rating` vs `overall_rating` corrections, this section should be updated with **confirmed, first-hand findings** once the API/WS test suites are implemented — replace "Confirm..." action items with concrete ✅/⚠️ notes describing the real observed behavior.

---

## Implementation Notes

### New Dependency Required

Playwright's `request` fixture does not speak WebSocket. Chaos/WS test automation for this app requires a Node WebSocket client library, which is **not yet part of the stack** documented in `QA_PROJECT_ARCHITECTURE.md` §2:

```powershell
npm install ws --save-dev
npm install --save-dev @types/ws
```

> Add this to `QA_PROJECT_ARCHITECTURE.md` §2 (Tech Stack table) once the chaos suite lands — commit as `chore: add ws package for crypto WebSocket testing`.

### Suggested File Locations (consistent with §3 of the architecture)

```
src/
├── e2e/
│   └── crypto/                      # UI-level chaos tests (QA Control Panel clicks)
│       └── chaos.spec.ts
├── api/
│   └── crypto/
│       ├── rest.api.spec.ts         # GET /prices, /profile, POST /inject, /reset
│       └── websocket.spec.ts        # Trade execution, malformed payloads, race conditions
├── utils/
│   └── crypto-ws-client.ts          # Thin wrapper around `ws` for connect/auth/send/await-message
└── types/
    └── crypto.types.ts              # TickMessage, TradeOrder, TradeResult, ProfileResponse, etc.
```

### Authentication

```typescript
// REST — header, same pattern as Market/Hotel but different header name
headers: {
  'x-api-key': process.env.QACLOUD_API_KEY
}

// WebSocket — query param on connect
const ws = new WebSocket(`ws://${host}/ws/crypto?api_key=${process.env.QACLOUD_API_KEY}`);
```

### Reset Strategy

```typescript
// beforeEach of destructive/chaos suites — resets portfolio only
await request.post('/api/crypto/reset', { headers: { 'x-api-key': apiKey } });
// ⚠️ Does NOT reset or pause the shared live price feed.
// Never assert on an exact price value — assert on relationships
// (e.g. balance delta vs. the price echoed back in trade_result).
```

### Avoiding Flakiness on the Shared Price Feed

```typescript
// ❌ Flaky — price will have moved by the time this assertion runs
expect(profile.balance_usd).toBe(10000 - 46230.50 * 0.01);

// ✅ Correct — use the price echoed back in the trade_result message itself
const tradeResult = await sendTradeAndAwaitResult(ws, { action: 'BUY', symbol: 'BTC', amount: 0.01 });
expect(tradeResult.balance_usd).toBeCloseTo(previousBalance - tradeResult.cost, 2);
```

### Confirmation / Order ID Note

Unlike Market (`O#####`) and Hotel (`HB########-######`), the Crypto Simulator's wiki does not document a distinct trade/order ID format — trades are referenced positionally within `profile.orders` (last 50). Confirm during TC-CRY-WS-003 implementation whether individual trade records expose their own ID field, and document it here once confirmed.
