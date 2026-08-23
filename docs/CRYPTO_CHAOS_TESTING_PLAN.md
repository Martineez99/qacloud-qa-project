# Crypto Simulator — Chaos Testing Plan (WebSocket)

> **Status:** 🟡 Planned — pending implementation
> **Branch:** `feature/crypto-chaos-testing`
> **Related to:** `docs/CRYPTO_APP_CONTEXT.md`, `docs/QA_PROJECT_ARCHITECTURE.md` §4.2, §10 (Sprint 4)
> **Precedes:** `src/api/crypto/websocket.spec.ts`, `src/utils/crypto-ws-client.ts`

This document defines the design of the Chaos Testing suite for the Crypto
Simulator application **before** writing any code, following the same
convention established by `docs/HOTEL_PERFORMANCE_PLAN.md`: design first,
document it, and only then implement.

---

## 1. Objective

Unlike Hotel's spike test (`HOTEL_PERFORMANCE_PLAN.md`, measuring
**performance** under concurrency with K6), the objective here is **functional
correctness under adverse conditions**: verifying that the real-time trading
system behaves predictably and safely when subjected to the chaos scenarios
exposed by the platform's own QA Control Panel. Focus areas:

- **Data integrity under concurrency** (Rapid Fire Orders): balance and trade
  count must always be correct — never negative, never duplicated.
- **Connection resilience** (high latency, simulated server crash): the client
  must not lose or duplicate trades, and reconnection must work correctly.
- **Malicious/erroneous input validation** (negative amount, string amount,
  non-existent symbol): document the server's actual behavior for each case,
  since the platform itself flags these three as **FAIL** in its wiki
  (`CRYPTO_APP_CONTEXT.md` §11) — our job is to confirm it with automated
  evidence, not to assume it.
- **Floating-point data precision** (P&L after multiple small trades), as a
  direct parallel to the price-snapshot integrity testing already done for
  Market (`MARKET_APP_CONTEXT.md`, Task 8).

This is **not a K6 load test** — it is a functional suite (Playwright + `ws`)
that lives in the API/E2E layer of the testing pyramid
(`QA_PROJECT_ARCHITECTURE.md` §4.1), focused on robustness under chaos, not on
throughput or concurrent VUs. A potential load test against the WebSocket
itself (many concurrent VUs) is out of scope for this document (see §8).

## 2. Test type and scope

Reference from the original spec (`QA_PROJECT_ARCHITECTURE.md` §4.2): *"Chaos
Mode — Crypto | Priority P2 | Tags `@chaos @e2e`"*.

| Category | Cases covered (from `CRYPTO_APP_CONTEXT.md` §9) | Tooling |
|---|---|---|
| Latency | TC-CRY-CHAOS-001, 002 | Playwright + `ws` (`qa_control` message) |
| Connection drop / reconnect | TC-CRY-CHAOS-003, 004 | Playwright + `ws` (`close` event) |
| Concurrency (Rapid Fire) | TC-CRY-CHAOS-005, 006, 007 | Playwright + `ws` (multiple sockets/concurrent sends) |
| Price direction injection | TC-CRY-CHAOS-008, 009, 010 | Playwright + `request` (REST `/inject`) + `ws` (tick observation) |
| Malformed payloads | TC-CRY-CHAOS-011 (groups TC-CRY-WS-007/008/009/010/011) | Playwright + `ws` |

> The **pure REST** test cases (`TC-CRY-API-*`) and **normal trading** cases
> (`TC-CRY-WS-001` through `006`, `013`, `014`) are not part of this chaos
> plan — they are implemented as a separate API/WebSocket "happy path + edge
> cases" suite, either in parallel or in a later session, following the same
> pattern Market used to split "CRUD — happy path" from "CRUD — edge cases"
> into two distinct spec files. This document focuses exclusively on the QA
> Control Panel's **chaos** scenarios.

## 3. Architecture decision: UI (QA Control Panel) or direct message?

There are two ways to trigger each chaos scenario:

1. **Via UI** — clicking the QA Control Panel buttons (`/crypto.html`)
2. **Via direct message** — sending the equivalent WS/REST message from the
   test itself (e.g. `{ "type": "qa_control", "action": "set_latency", "value": true }`)

**Decision:** use the **direct message** approach as the base for functional
assertions (more deterministic, no UI flakiness), and reserve **a single
complementary E2E test per scenario** that does go through the QA Control
Panel in the UI, to confirm the panel actually triggers the control
(UI ↔ backend integration coverage). This is consistent with the testing
pyramid (`QA_PROJECT_ARCHITECTURE.md` §4.1): most chaos coverage lives in the
API/WS layer, with a thin E2E layer on top that only confirms the buttons
work.

```
src/api/crypto/websocket.spec.ts        → chaos logic via direct messages (core coverage)
src/e2e/crypto/qa-control-panel.spec.ts → real clicks on the QA Control Panel (thin confirmation layer)
```

## 4. Data strategy

### 4.1 Reset before each test — with an important caveat

Unlike Market and Hotel, Crypto's reset (`POST /api/crypto/reset`) **only**
affects the calling user's portfolio (balance, holdings, trade history) — it
does **not** pause or restart the shared price feed
(`CRYPTO_APP_CONTEXT.md` §2, §6.4). Therefore:

```typescript
// beforeEach of every chaos test — restores the portfolio, NOT the market
await request.post('/api/crypto/reset', { headers: { 'x-api-key': apiKey } });
```

**Accepted consequence:** tests must **never** assert on an exact price
value. Every balance assertion must be based on the price the server itself
returns inside `trade_result`, not on a previously read or hardcoded value.
This is already documented as a mandatory design pattern in
`CRYPTO_APP_CONTEXT.md` (section "Avoiding Flakiness on the Shared Price
Feed") and is reused here as a design rule for the entire suite.

### 4.2 Isolation between concurrency tests

The Rapid Fire tests (TC-CRY-CHAOS-005/006/007) generate 10 parallel
operations against the **same** user/socket. For the "expected final balance"
calculation to be verifiable, each test in this block must:

1. Reset the portfolio (§4.1)
2. Record the post-reset `balance_usd` (always `10000.00`, deterministic)
3. Fire the 10 concurrent operations
4. Collect the 10 `trade_result` messages (by `symbol` + arrival order, since
   there is no documented trade/order ID — see the open note in
   `CRYPTO_APP_CONTEXT.md`, section "Confirmation / Order ID Note")
5. Verify: `final_balance = 10000 − Σ(cost_i from each successful trade_result)`

### 4.3 Sequential, not parallel, execution for this suite

Since the price feed is **global and shared across every connected user**
(not just among the tests of a single run), running this suite in parallel
with other suites that also operate against Crypto (or with multiple
Playwright workers within the chaos suite itself) introduces cross-test
interference that is hard to debug. Decision, consistent with
`QA_PROJECT_ARCHITECTURE.md` §6.2 (*"API Tests: Sequential (`--workers=1`)"*):

```typescript
// config/playwright.config.ts — dedicated project for Crypto chaos
{
  name: 'crypto-chaos',
  testDir: 'src/api/crypto',
  fullyParallel: false,
  workers: 1,
}
```

### 4.4 WebSocket client helper

A thin wrapper around the `ws` library is needed to avoid repeating
connection/authentication/message-waiting logic in every test:

```typescript
// src/utils/crypto-ws-client.ts — proposed skeleton
export class CryptoWsClient {
  connect(apiKey?: string): Promise<void> { /* ws://.../ws/crypto?api_key=... */ }
  sendTrade(action: 'BUY' | 'SELL', symbol: string, amount: number | string): void { }
  sendQaControl(action: string, value: unknown): void { }
  awaitMessage(predicate: (msg: any) => boolean, timeoutMs = 5000): Promise<any> { }
  awaitNTicks(n: number): Promise<any[]> { }
  close(): void { }
}
```

## 5. Acceptance criteria per scenario (not load thresholds — functional criteria)

Unlike Hotel's spike test (which uses `p95`/`p99` latency thresholds), the
"acceptance criteria" here are **functional**: the suite passes or fails
based on business invariants being upheld, not on a percentile.

| Scenario | Acceptance criterion |
|---|---|
| High latency | The trade executes exactly once; `trade_result` arrives with correct data, even if delayed |
| Simulated crash | The connection closes (observable `close` event); no further ticks arrive on the closed socket |
| Reconnection | A new socket opens and ticks resume within a reasonable time window (define an operational threshold, e.g. <5s — not a production SLA, just a practical bound so the test doesn't hang) |
| Rapid Fire (10 concurrent) | 10 distinct `trade_result` messages; final balance = starting balance − Σ costs; `total_trades` increases by exactly 10; balance is never negative |
| Price injection | The majority of consecutive ticks during the injection window move in the requested direction; the price never crosses the documented minimum floor |
| Malformed payloads | Each case explicitly documents: structured error? silent no-op? connection drop? — the result is recorded in `CRYPTO_APP_CONTEXT.md` §11 after the first real run |

> No K6-style latency thresholds (`p95<Xms`) are proposed here because this is
> not a performance test — if a real-load WebSocket test (many simultaneous
> connections) is desired in the future, it would be a separate plan document,
> using K6 or Artillery, analogous in spirit to `HOTEL_PERFORMANCE_PLAN.md`
> but for WS (see §8).

## 6. File structure to create

```
src/
├── api/
│   └── crypto/
│       └── websocket.spec.ts         ← new — main chaos suite (direct messages)
├── e2e/
│   └── crypto/
│       └── qa-control-panel.spec.ts  ← new — thin E2E layer over the panel's buttons
├── utils/
│   └── crypto-ws-client.ts           ← new — connect/send/await wrapper over `ws`
└── types/
    └── crypto.types.ts               ← new — TickMessage, TradeOrder, TradeResult, QaControlMessage
```

`config/playwright.config.ts` — add the `crypto-chaos` project described in
§4.3.

`package.json` (§8.2 of the architecture) — add:

```json
"test:chaos:crypto": "playwright test --project=crypto-chaos"
```

## 7. CI integration

Proposal: either a new lightweight workflow, or a job inside `api-tests.yml`
(to be decided based on actual execution time once implemented — if the
latency + reconnection suite takes too long, a standalone workflow is
preferable so it doesn't block the main API pipeline).

```yaml
# Initial proposal — job inside api-tests.yml
crypto-chaos-tests:
  name: Crypto Chaos Tests
  runs-on: ubuntu-latest
  needs: market-api-tests   # or hotel-api-tests, TBD — must not run in parallel
                            # with another suite that depends on deterministic
                            # Crypto state
  env:
    QACLOUD_BASE_URL: ${{ secrets.QACLOUD_BASE_URL }}
    QACLOUD_API_KEY:  ${{ secrets.QACLOUD_API_KEY }}
  steps:
    - uses: actions/checkout@v4
    - name: Install dependencies
      run: npm ci
    - name: Run Crypto chaos suite
      run: npx playwright test --project=crypto-chaos
    - name: Upload Allure results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: crypto-chaos-allure-results
        path: reports/allure-results/
        retention-days: 30
```

> Open note, to be decided during the CI implementation session (a separate
> step, just like in Hotel §9 of the performance plan): if this suite ends up
> with long execution times due to the latency/reconnection tests (real
> multi-second waits), it may be worth giving it its own workflow
> (`chaos-tests.yml`) instead of adding to `api-tests.yml`'s runtime.

## 8. Out of scope (for now)

- **Real load test against the WebSocket itself** (hundreds of concurrent
  connections) — would be a separate plan document, using K6 (which supports
  WebSocket via `k6/ws` from v0.33+) or Artillery, analogous in spirit to
  `HOTEL_PERFORMANCE_PLAN.md` but for WS. Candidate for a future Sprint 4
  iteration if measuring the price feed's throughput becomes a priority.
- **"Happy path + edge cases" trading suite** (`TC-CRY-WS-001` through `006`,
  `013`, `014`, and the entire `TC-CRY-API-*` family) — not chaos testing,
  implemented as a separate API/WS suite.
- **Full QA Control Panel UI automation** for every control — only one thin
  E2E test per scenario is covered (§3), not an exhaustive E2E suite of the
  panel's UI.
- Visual regression, RBAC (TaskTracker), Security suite — belong to other
  items on the Sprint 4 roadmap (`QA_PROJECT_ARCHITECTURE.md` §10), not to
  this document.

## 9. Next steps (one session each)

1. ✅ `docs/CRYPTO_APP_CONTEXT.md`
2. ✅ This plan document
3. 🔲 `src/types/crypto.types.ts`
4. 🔲 `src/utils/crypto-ws-client.ts`
5. 🔲 `src/api/crypto/websocket.spec.ts` (malformed payloads — TC-CRY-CHAOS-011, the block with the fewest external dependencies and the most suitable starting point)
6. 🔲 `src/api/crypto/websocket.spec.ts` (latency + reconnection — TC-CRY-CHAOS-001 through 004)
7. 🔲 `src/api/crypto/websocket.spec.ts` (rapid fire / concurrency — TC-CRY-CHAOS-005 through 007)
8. 🔲 `src/api/crypto/websocket.spec.ts` (price injection — TC-CRY-CHAOS-008 through 010)
9. 🔲 `src/e2e/crypto/qa-control-panel.spec.ts` (thin E2E layer)
10. 🔲 Add the `crypto-chaos` project to `config/playwright.config.ts` and the `test:chaos:crypto` script to `package.json`
11. 🔲 CI integration (job or workflow, per §7)
12. 🔲 Update `README.md` (Performance/Chaos coverage table) and the Sprint 4 roadmap in `QA_PROJECT_ARCHITECTURE.md`
13. 🔲 Fill in `CRYPTO_APP_CONTEXT.md` §11 with real findings after the first run (analogous to `HOTEL_PERFORMANCE_PLAN.md` §10)
14. 🔲 Open a PR toward `develop`
