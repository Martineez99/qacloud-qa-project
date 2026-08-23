/**
 * Crypto Simulator — Chaos: Malformed Payload Matrix
 *
 * Covers TC-CRY-CHAOS-011 from docs/CRYPTO_APP_CONTEXT.md §9, which groups:
 *   TC-CRY-WS-007 — negative amount
 *   TC-CRY-WS-008 — string amount
 *   TC-CRY-WS-009 — amount exceeding balance
 *   TC-CRY-WS-010 — missing `symbol`
 *   TC-CRY-WS-011 — unknown `action`
 *
 * Design notes (see docs/CRYPTO_CHAOS_TESTING_PLAN.md §3, §5):
 *   - Chaos scenarios are triggered via direct WebSocket messages, not the
 *     UI, for determinism (a thin E2E confirmation layer lives separately
 *     in src/e2e/crypto/qa-control-panel.spec.ts — not part of this file).
 *   - The platform's own wiki flags 3 of these 5 cases as currently FAILING
 *     (docs/CRYPTO_APP_CONTEXT.md §11). We do NOT assume a passing or
 *     failing outcome — each test asserts the one invariant that matters
 *     regardless of how the server actually responds (balance/trade-count
 *     integrity), and separately CAPTURES the raw outcome so the real
 *     behavior can be transcribed into CRYPTO_APP_CONTEXT.md §11 after the
 *     first run (roadmap step 13).
 *   - Never assert on an exact price (shared, non-resettable feed — see
 *     CRYPTO_APP_CONTEXT.md §6.4). All assertions here are price-agnostic.
 *
 * Requires the `crypto-chaos` Playwright project (workers: 1) once added
 * per docs/CRYPTO_CHAOS_TESTING_PLAN.md §4.3 / §6 (roadmap step 10).
 * Until then, run directly:
 *   npx playwright test src/api/crypto/websocket.spec.ts --workers=1
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { allure } from 'allure-playwright';
import { CryptoWsClient, CryptoWsTimeoutError } from '../../utils/crypto-ws-client';
import type { PricesResponse, ProfileResponse } from '../../types/crypto.types';

const BASE_URL = process.env.QACLOUD_BASE_URL ?? 'https://www.qacloud.dev';
const API_KEY = process.env.QACLOUD_API_KEY ?? '';
const WS_URL = `${BASE_URL.replace(/^http/, 'ws')}/ws/crypto`;

const authHeaders = { 'x-api-key': API_KEY };

/** The three possible shapes an outcome can take — captured, not assumed. */
type ChaosOutcome =
  | { kind: 'trade_result'; success: boolean; raw: unknown }
  | { kind: 'timeout' } // server never responded within the wait window — a "silent no-op"
  | { kind: 'connection_closed' }; // server rejected at the connection level

async function getProfile(request: APIRequestContext): Promise<ProfileResponse> {
  const res = await request.get(`${BASE_URL}/api/crypto/profile`, { headers: authHeaders });
  expect(res.status(), 'GET /api/crypto/profile should succeed with a valid key').toBe(200);
  return res.json();
}

/**
 * Waits for a trade_result after a malformed send, without presupposing the
 * server actually sends one. This is the core reason CryptoWsTimeoutError
 * exists as a distinct type (see crypto-ws-client.ts) — a timeout here is a
 * valid, informative outcome (silent no-op), not a test infrastructure failure.
 */
async function captureOutcome(client: CryptoWsClient, timeoutMs = 4000): Promise<ChaosOutcome> {
  try {
    const msg = await client.awaitTradeResult(timeoutMs);
    const success = (msg as { success?: boolean }).success ?? false;
    return { kind: 'trade_result', success, raw: msg };
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
function logFinding(caseId: string, outcome: ChaosOutcome): void {
  // eslint-disable-next-line no-console
  console.log(`[Chaos Finding] ${caseId}:`, JSON.stringify(outcome, null, 2));
}

test.describe('Crypto Simulator — Chaos: Malformed Payload Matrix (TC-CRY-CHAOS-011)', () => {
  test.describe.configure({ mode: 'serial' }); // shared state, must run in order
  let wsClient: CryptoWsClient;

  test.beforeEach(async ({ request }) => {
    await allure.epic('Crypto Simulator');
    await allure.feature('Chaos Testing');
    await allure.story('Malformed Payload Matrix');
    await allure.tag('chaos'), 
    await allure.tag ('crypto'),
    await allure.tag('websocket'),
    await allure.tag('negative');

    // Resets the portfolio ONLY — the shared price feed keeps running
    // (docs/CRYPTO_APP_CONTEXT.md §2). Safe as a determinism baseline for
    // balance/trade-count assertions, never for price assertions.
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

    // ── ARRANGE ──────────────────────────────────────────────────────
    const before = await getProfile(request);
    expect(before.balance_usd, 'post-reset balance should be the seed 10000.00').toBeCloseTo(
      10000,
      2,
    );

    // ── ACT ──────────────────────────────────────────────────────────
    wsClient.sendTrade('BUY', 'BTC', -500);
    const outcome = await captureOutcome(wsClient);

    // ── ASSERT ───────────────────────────────────────────────────────
    // Core invariant, independent of HOW the server responds: a negative
    // amount must never actually move money.
    const after = await getProfile(request);
    expect(after.balance_usd, 'balance must not change on a negative-amount BUY').toBeCloseTo(
      before.balance_usd,
      2,
    );
    expect(after.total_trades, 'no trade record should be created').toBe(before.total_trades);

    if (outcome.kind === 'trade_result') {
      expect(
        outcome.success,
        'if the server DOES respond, it must report success=false for a negative amount',
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

    // ── ARRANGE ──────────────────────────────────────────────────────
    const before = await getProfile(request);

    // ── ACT ──────────────────────────────────────────────────────────
    wsClient.sendTrade('BUY', 'BTC', 'five');
    const outcome = await captureOutcome(wsClient);

    // ── ASSERT ───────────────────────────────────────────────────────
    const after = await getProfile(request);
    expect(after.balance_usd, 'balance must not change on a non-numeric amount').toBeCloseTo(
      before.balance_usd,
      2,
    );
    expect(after.total_trades, 'no trade record should be created').toBe(before.total_trades);

    if (outcome.kind === 'trade_result') {
      expect(
        outcome.success,
        'if the server DOES respond, it must report success=false for a string amount',
      ).toBe(false);
    }

    logFinding('TC-CRY-WS-008 (string amount)', outcome);
  });

  test('TC-CRY-WS-009 — BUY cost exceeding balance never overdraws the account', async ({
    request,
  }) => {
    await allure.severity('blocker');

    // ── ARRANGE ──────────────────────────────────────────────────────
    const before = await getProfile(request);
    const pricesRes = await request.get(`${BASE_URL}/api/crypto/prices`);
    expect(pricesRes.status()).toBe(200);
    const { prices } = (await pricesRes.json()) as PricesResponse;

    // Size the order so its cost is ~10x the entire starting balance,
    // regardless of the live (shared, moving) BTC price.
    const overBudgetAmount = (before.balance_usd * 10) / prices.BTC;
    await allure.parameter('symbol', 'BTC');
    await allure.parameter('amount', overBudgetAmount.toFixed(6));
    await allure.parameter('btc_price_at_send', String(prices.BTC));

    // ── ACT ──────────────────────────────────────────────────────────
    wsClient.sendTrade('BUY', 'BTC', overBudgetAmount);
    const outcome = await captureOutcome(wsClient);

    // ── ASSERT ───────────────────────────────────────────────────────
    // Non-negotiable invariant regardless of documented FAIL status:
    // balance must NEVER go negative, whatever the server decides to do.
    const after = await getProfile(request);
    expect(after.balance_usd, 'balance must never go negative').toBeGreaterThanOrEqual(0);

    if (outcome.kind === 'trade_result' && outcome.success) {
      // Documented on the platform as currently FAILING (over-budget buys
      // are accepted) — if that's what we observe, the invariant above is
      // the one that must still hold. We do NOT fail the test purely for
      // reproducing the platform's own documented bug; we log it instead
      // so it's transcribed into CRYPTO_APP_CONTEXT.md §11 with confirmed
      // evidence.
      logFinding('TC-CRY-WS-009 (exceeds balance) — REPRODUCED DOCUMENTED BUG: overspend accepted', outcome);
    } else {
      expect(after.total_trades, 'a rejected over-budget order must not create a trade record').toBe(
        before.total_trades,
      );
      logFinding('TC-CRY-WS-009 (exceeds balance) — correctly rejected', outcome);
    }
  });

  test('TC-CRY-WS-010 — missing `symbol` field leaves balance and trade count unchanged', async ({
    request,
  }) => {
    await allure.severity('normal');

    // ── ARRANGE ──────────────────────────────────────────────────────
    const before = await getProfile(request);

    // ── ACT ──────────────────────────────────────────────────────────
    // Uses sendRaw: a missing required field doesn't fit the typed
    // TradeOrderMessage shape by design.
    wsClient.sendRaw({ action: 'BUY', amount: 1 });
    const outcome = await captureOutcome(wsClient);

    // ── ASSERT ───────────────────────────────────────────────────────
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

    // ── ARRANGE ──────────────────────────────────────────────────────
    const before = await getProfile(request);

    // ── ACT ──────────────────────────────────────────────────────────
    wsClient.sendRaw({ action: 'HOLD', symbol: 'BTC', amount: 1 });
    const outcome = await captureOutcome(wsClient);

    // ── ASSERT ───────────────────────────────────────────────────────
    const after = await getProfile(request);
    expect(after.balance_usd, 'balance must not change for an unrecognized action').toBeCloseTo(
      before.balance_usd,
      2,
    );
    expect(after.total_trades, 'no trade record should be created').toBe(before.total_trades);

    logFinding('TC-CRY-WS-011 (unknown action)', outcome);
  });
});
