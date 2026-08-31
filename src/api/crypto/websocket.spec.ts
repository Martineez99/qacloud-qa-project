/**
 * Crypto Simulator — Chaos: Malformed Payload Matrix & Latency Injection
 *
 * Covers:
 *   TC-CRY-CHAOS-011 (docs/CRYPTO_APP_CONTEXT.md §9), grouping:
 *     TC-CRY-WS-007 — negative amount
 *     TC-CRY-WS-008 — string amount
 *     TC-CRY-WS-009 — amount exceeding balance
 *     TC-CRY-WS-010 — missing `symbol`
 *     TC-CRY-WS-011 — unknown `action`
 *   TC-CRY-CHAOS-001 / 002 — High Latency Mode
 *
 * ⚠️ PROTOCOL CORRECTION: the REAL confirmed protocol is `init` (one-time
 * snapshot), `price` (one PER coin, not a bundled `tick`), `qa_ack`
 * (confirms a qa_control action), and `order_filled` (a successful trade —
 * nested `order` + `state`, no `success` boolean). The shape of a REJECTED
 * order is still NOT confirmed — see docs/CRYPTO_APP_CONTEXT.md §11.
 *
 * ⚠️ HIGH LATENCY MECHANISM CORRECTION (confirmed via
 * src/api/crypto/latency-diagnostics.spec.ts): "High Latency (3s delay)"
 * was assumed to delay the order_filled round-trip. Real measurement:
 *   - 8 price ticks: ~711ms baseline → ~3971ms under latency (+3260ms)
 *   - Trade round-trip: ~364ms baseline → ~363ms under latency (no change)
 * Latency mode delays the PRICE FEED broadcast, NOT trade execution. The
 * tests below assert exactly that: ticks are measurably delayed, trades
 * are NOT. The original TC-CRY-CHAOS-001/002 asserted the opposite
 * (expected the trade to be delayed) and failed against real behavior —
 * this version replaces that incorrect assumption entirely.
 *
 * ⚠️ SINCE-INDEX: `awaitOrderOutcome`/`awaitQaAck` take a `sinceIndex`
 * (`client.history.length` captured right before the triggering send) so a
 * second wait for the same message type on one connection doesn't match a
 * stale earlier message — see the doc comment on `awaitMessage` in
 * crypto-ws-client.ts.
 *
 * Design notes (see docs/CRYPTO_CHAOS_TESTING_PLAN.md §3, §5):
 *   - Chaos scenarios are triggered via direct WebSocket messages, not the
 *     UI (a thin E2E confirmation layer lives separately in
 *     src/e2e/crypto/qa-control-panel.spec.ts — not part of this file).
 *   - Never assert on an exact price (shared, non-resettable feed — see
 *     CRYPTO_APP_CONTEXT.md §6.4). All assertions here are price-agnostic.
 *   - TC-CRY-CHAOS-003/004 (Simulate Server Crash + reconnection) live in
 *     their own file — action name CONFIRMED as `'crash'` (NOT
 *     `'simulate_crash'`) via src/api/crypto/crash-diagnostics.spec.ts.
 *
 * Requires the `crypto-chaos` Playwright project (workers: 1, timeout ≥
 * 45000ms) — see config/playwright.config.ts, project `api-crypto-chaos`.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { allure } from 'allure-playwright';
import { CryptoWsClient, CryptoWsTimeoutError } from '../../utils/crypto-ws-client';
import type { OrderFilledMessage, PricesResponse, ProfileResponse } from '../../types/crypto.types';

const BASE_URL = process.env.QACLOUD_BASE_URL ?? 'https://www.qacloud.dev';
const API_KEY = process.env.QACLOUD_API_KEY ?? '';
const WS_URL = `${BASE_URL.replace(/^http/, 'ws')}/ws/crypto`;

const authHeaders = { 'x-api-key': API_KEY };

/** The three possible shapes an outcome can take — captured, not assumed. */
type ChaosOutcome =
  | { kind: 'order_outcome'; messageType: string; success: boolean; raw: unknown }
  | { kind: 'timeout' } // server never responded within the wait window — a "silent no-op"
  | { kind: 'connection_closed' }; // server rejected at the connection level

async function getProfile(request: APIRequestContext): Promise<ProfileResponse> {
  const res = await request.get(`${BASE_URL}/api/crypto/profile`, { headers: authHeaders });
  expect(res.status(), 'GET /api/crypto/profile should succeed with a valid key').toBe(200);
  return res.json();
}

/**
 * Waits for an order outcome after a send, without presupposing the server
 * actually responds with `order_filled` specifically. `success` is true
 * only for a confirmed `order_filled` — any other `order*` type (once its
 * real name is confirmed) is treated as a rejection, and a timeout is
 * treated as a silent no-op. All three are valid, informative outcomes.
 *
 * `sinceIndex` should be `client.history.length` captured right before the
 * triggering send.
 */
async function captureOutcome(
  client: CryptoWsClient,
  sinceIndex: number,
  timeoutMs = 4000,
): Promise<ChaosOutcome> {
  try {
    const msg = await client.awaitOrderOutcome(timeoutMs, sinceIndex);
    const messageType = (msg as { type: string }).type;
    return { kind: 'order_outcome', messageType, success: messageType === 'order_filled', raw: msg };
  } catch (err) {
    if (err instanceof CryptoWsTimeoutError) {
      return client.wasClosed ? { kind: 'connection_closed' } : { kind: 'timeout' };
    }
    throw err;
  }
}

/**
 * Logs the raw finding for this run. This is intentionally a console log,
 * not an assertion: the goal of this suite is as much *documentation* of
 * real behavior (to transcribe into CRYPTO_APP_CONTEXT.md §11) as it is
 * pass/fail verification of the invariants below.
 */
function logFinding(caseId: string, outcome: ChaosOutcome | Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(`[Chaos Finding] ${caseId}:`, JSON.stringify(outcome, null, 2));
}

test.describe('Crypto Simulator — Chaos: Malformed Payload Matrix (TC-CRY-CHAOS-011)', () => {
  let wsClient: CryptoWsClient;

  test.beforeEach(async ({ request }) => {
    await allure.epic('Crypto Simulator');
    await allure.feature('Chaos Testing');
    await allure.story('Malformed Payload Matrix');
    await allure.tag('chaos');
    await allure.tag('crypto');
    await allure.tag('websocket');
    await allure.tag('negative');

    const resetRes = await request.post(`${BASE_URL}/api/crypto/reset`, { headers: authHeaders });
    expect(resetRes.status()).toBe(200);

    wsClient = new CryptoWsClient({ wsUrl: WS_URL, apiKey: API_KEY });
    await wsClient.connect();
  });

  test.afterEach(() => {
    wsClient?.close();
  });

  test('TC-CRY-WS-007 — negative amount BUY leaves balance and trade count unchanged', async ({
    request,
  }) => {
    await allure.severity('critical');
    await allure.parameter('symbol', 'BTC');
    await allure.parameter('amount', '-500');

    const before = await getProfile(request);
    expect(before.balance_usd, 'post-reset balance should be the seed 10000.00').toBeCloseTo(
      10000,
      2,
    );

    const sinceIndex = wsClient.history.length;
    wsClient.sendTrade('BUY', 'BTC', -500);
    const outcome = await captureOutcome(wsClient, sinceIndex);

    const after = await getProfile(request);
    expect(after.balance_usd, 'balance must not change on a negative-amount BUY').toBeCloseTo(
      before.balance_usd,
      2,
    );
    expect(after.total_trades, 'no trade record should be created').toBe(before.total_trades);

    if (outcome.kind === 'order_outcome') {
      expect(
        outcome.success,
        'if the server DOES respond, it must NOT be an order_filled for a negative amount',
      ).toBe(false);
    }

    logFinding('TC-CRY-WS-007 (negative amount)', outcome);
  });

  test('TC-CRY-WS-008 — string amount BUY leaves balance and trade count unchanged', async ({
    request,
  }) => {
    await allure.severity('critical');
    await allure.parameter('symbol', 'BTC');
    await allure.parameter('amount', '"five"');

    const before = await getProfile(request);

    const sinceIndex = wsClient.history.length;
    wsClient.sendTrade('BUY', 'BTC', 'five');
    const outcome = await captureOutcome(wsClient, sinceIndex);

    const after = await getProfile(request);
    expect(after.balance_usd, 'balance must not change on a non-numeric amount').toBeCloseTo(
      before.balance_usd,
      2,
    );
    expect(after.total_trades, 'no trade record should be created').toBe(before.total_trades);

    if (outcome.kind === 'order_outcome') {
      expect(
        outcome.success,
        'if the server DOES respond, it must NOT be an order_filled for a string amount',
      ).toBe(false);
    }

    logFinding('TC-CRY-WS-008 (string amount)', outcome);
  });

  test('TC-CRY-WS-009 — BUY cost exceeding balance never overdraws the account', async ({
    request,
  }) => {
    await allure.severity('blocker');

    const before = await getProfile(request);
    const pricesRes = await request.get(`${BASE_URL}/api/crypto/prices`);
    expect(pricesRes.status()).toBe(200);
    const { prices } = (await pricesRes.json()) as PricesResponse;

    const overBudgetAmount = (before.balance_usd * 10) / prices.BTC;
    await allure.parameter('symbol', 'BTC');
    await allure.parameter('amount', overBudgetAmount.toFixed(6));
    await allure.parameter('btc_price_at_send', String(prices.BTC));

    const sinceIndex = wsClient.history.length;
    wsClient.sendTrade('BUY', 'BTC', overBudgetAmount);
    const outcome = await captureOutcome(wsClient, sinceIndex);

    const after = await getProfile(request);
    expect(after.balance_usd, 'balance must never go negative').toBeGreaterThanOrEqual(0);

    if (outcome.kind === 'order_outcome' && outcome.success) {
      logFinding(
        'TC-CRY-WS-009 (exceeds balance) — REPRODUCED DOCUMENTED BUG: overspend accepted',
        outcome,
      );
    } else {
      expect(
        after.total_trades,
        'a rejected over-budget order must not create a trade record',
      ).toBe(before.total_trades);
      logFinding('TC-CRY-WS-009 (exceeds balance) — correctly rejected', outcome);
    }
  });

  test('TC-CRY-WS-010 — missing `symbol` field leaves balance and trade count unchanged', async ({
    request,
  }) => {
    await allure.severity('normal');

    const before = await getProfile(request);

    const sinceIndex = wsClient.history.length;
    wsClient.sendRaw({ action: 'BUY', amount: 1 });
    const outcome = await captureOutcome(wsClient, sinceIndex);

    const after = await getProfile(request);
    expect(after.balance_usd, 'balance must not change when symbol is missing').toBeCloseTo(
      before.balance_usd,
      2,
    );
    expect(after.total_trades, 'no trade record should be created').toBe(before.total_trades);

    logFinding('TC-CRY-WS-010 (missing symbol)', outcome);
  });

  test('TC-CRY-WS-011 — unknown `action` value produces no state change', async ({ request }) => {
    await allure.severity('normal');

    const before = await getProfile(request);

    const sinceIndex = wsClient.history.length;
    wsClient.sendRaw({ action: 'HOLD', symbol: 'BTC', amount: 1 });
    const outcome = await captureOutcome(wsClient, sinceIndex);

    const after = await getProfile(request);
    expect(after.balance_usd, 'balance must not change for an unrecognized action').toBeCloseTo(
      before.balance_usd,
      2,
    );
    expect(after.total_trades, 'no trade record should be created').toBe(before.total_trades);

    logFinding('TC-CRY-WS-011 (unknown action)', outcome);
  });
});

test.describe('Crypto Simulator — Chaos: High Latency Mode (TC-CRY-CHAOS-001 / 002)', () => {
  let wsClient: CryptoWsClient;

  test.beforeEach(async ({ request }) => {
    await allure.epic('Crypto Simulator');
    await allure.feature('Chaos Testing');
    await allure.story('High Latency Mode');
    await allure.tag('chaos');
    await allure.tag('crypto');
    await allure.tag('websocket');
    await allure.tag('latency');

    const resetRes = await request.post(`${BASE_URL}/api/crypto/reset`, { headers: authHeaders });
    expect(resetRes.status()).toBe(200);

    wsClient = new CryptoWsClient({ wsUrl: WS_URL, apiKey: API_KEY });
    await wsClient.connect();
  });

  test.afterEach(() => {
    try {
      wsClient?.sendQaControl('set_latency', false);
    } catch {
      // socket may already be closed by the test itself — safe to ignore
    }
    wsClient?.close();
  });

  test('TC-CRY-CHAOS-001 — high latency measurably delays the price feed, not trade execution', async () => {
    await allure.severity('critical');

    // ── ARRANGE ── baseline: time to receive 8 price ticks, latency OFF
    const baselineTickStart = Date.now();
    await wsClient.awaitNTicks(8, 10000);
    const baselineTickMs = Date.now() - baselineTickStart;
    await allure.parameter('baseline_8_ticks_ms', String(baselineTickMs));

    // ── ACT ── enable latency, confirmed via qa_ack (not a blind sleep)
    const ackSinceIndex = wsClient.history.length;
    wsClient.sendQaControl('set_latency', true);
    await wsClient.awaitQaAck('set_latency', 4000, ackSinceIndex);

    // ── Measure ticks UNDER latency ─────────────────────────────────────
    const underLatencyTickStart = Date.now();
    await wsClient.awaitNTicks(8, 20000);
    const underLatencyTickMs = Date.now() - underLatencyTickStart;
    await allure.parameter('under_latency_8_ticks_ms', String(underLatencyTickMs));

    // ── Measure a trade round-trip UNDER latency ────────────────────────
    const tradeSinceIndex = wsClient.history.length;
    const tradeStart = Date.now();
    wsClient.sendTrade('BUY', 'BTC', 0.001);
    const filled = (await wsClient.awaitOrderOutcome(8000, tradeSinceIndex)) as OrderFilledMessage;
    const tradeUnderLatencyMs = Date.now() - tradeStart;
    await allure.parameter('trade_under_latency_ms', String(tradeUnderLatencyMs));

    // ── ASSERT ───────────────────────────────────────────────────────
    // The confirmed mechanism: latency delays the PRICE FEED broadcast.
    expect(
      underLatencyTickMs,
      'receiving 8 price ticks under High Latency Mode should take measurably longer than baseline',
    ).toBeGreaterThan(baselineTickMs);
    expect(
      underLatencyTickMs - baselineTickMs,
      'the added tick delay should be roughly the documented ~3s (generous tolerance for batching/network variance)',
    ).toBeGreaterThan(1500);

    // The confirmed mechanism: trade execution is NOT gated by the delayed
    // price broadcast — it must stay fast and must still fill correctly.
    expect(filled.type, 'trade must still fill under latency').toBe('order_filled');
    expect(
      tradeUnderLatencyMs,
      'trade execution must remain fast under High Latency Mode — it is NOT gated by the delayed price feed',
    ).toBeLessThan(2000);

    logFinding('TC-CRY-CHAOS-001 (latency mechanism)', {
      baselineTickMs,
      underLatencyTickMs,
      tradeUnderLatencyMs,
    });
  });

  test('TC-CRY-CHAOS-002 — trade executed during high latency returns correct data promptly', async ({
    request,
  }) => {
    await allure.severity('critical');

    // ── ARRANGE ──────────────────────────────────────────────────────
    const before = await getProfile(request);
    const ackSinceIndex = wsClient.history.length;
    wsClient.sendQaControl('set_latency', true);
    await wsClient.awaitQaAck('set_latency', 4000, ackSinceIndex);

    // ── ACT ──────────────────────────────────────────────────────────
    // Confirmed (TC-CRY-CHAOS-001): trade fills promptly regardless of the
    // delayed price feed, so a short timeout here is itself an assertion
    // that the order isn't queued behind the tick delay.
    const tradeSinceIndex = wsClient.history.length;
    wsClient.sendTrade('BUY', 'BTC', 0.001);
    const filled = (await wsClient.awaitOrderOutcome(4000, tradeSinceIndex)) as OrderFilledMessage;

    // ── ASSERT ───────────────────────────────────────────────────────
    expect(filled.type, 'trade must fill under latency').toBe('order_filled');
    expect(filled.order.symbol).toBe('BTC');
    expect(filled.order.action).toBe('BUY');
    expect(filled.order.price, 'server must report the execution price').toBeGreaterThan(0);
    expect(filled.order.cost, 'server-reported cost must equal price × amount').toBeCloseTo(
      filled.order.price * 0.001,
      6,
    );

    const after = await getProfile(request);
    expect(
      after.balance_usd,
      'REST profile balance must match state.balance_usd reported in order_filled',
    ).toBeCloseTo(filled.state.balance_usd, 2);
    expect(
      after.balance_usd,
      'balance delta must equal the reported order cost',
    ).toBeCloseTo(before.balance_usd - filled.order.cost, 2);
    expect(
      filled.state.balances.BTC,
      'reported BTC holding must include the 0.001 just bought',
    ).toBeCloseTo(0.001, 8);

    logFinding('TC-CRY-CHAOS-002 (latency correctness)', filled as unknown as Record<string, unknown>);
  });
});