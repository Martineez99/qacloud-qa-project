/**
 * Crypto Simulator — Domain Types
 *
 * Reference: docs/CRYPTO_APP_CONTEXT.md §6 (API Reference) — NOTE: §6.2 was
 *            corrected after live traffic capture; see the "Protocol
 *            Corrections" note there and docs/CRYPTO_CHAOS_TESTING_PLAN.md.
 *
 * ⚠️ PROTOCOL CORRECTION (confirmed via captured WS traffic, see
 * src/api/crypto/crash-diagnostics.spec.ts output): the platform's own wiki
 * documented a different WS message protocol than what the server actually
 * sends. These types reflect the CONFIRMED real shapes, not the wiki's:
 *
 *   - No single "tick" message bundling all 4 coins — the server sends one
 *     "price" message PER coin, each with its own type/pattern/injected.
 *   - No "trade_result" message — successful trades arrive as
 *     "order_filled", with a nested `order` + `state` object, not flat
 *     fields, and a real order ID (`TRD-<timestamp>`).
 *   - An undocumented "init" message arrives once, immediately after
 *     connecting: full portfolio snapshot + per-coin metadata + 300-point
 *     price history per coin (for charting).
 *   - An undocumented "qa_ack" message confirms a qa_control action was
 *     received (e.g. after toggling latency).
 *
 * The shape of a REJECTED order (negative amount, string amount, etc.) is
 * still NOT confirmed — see TC-CRY-WS-007/008/009/010/011 in
 * docs/CRYPTO_APP_CONTEXT.md §9. Do not assume it mirrors order_filled.
 */

// ─────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────

/** The 4 tradable coins on the platform. */
export type CryptoSymbol = 'BTC' | 'ETH' | 'SOL' | 'DOGE';

/** Direction used by POST /api/crypto/inject and the "Inject Price Direction" QA control. */
export type PriceDirection = 'up' | 'down';

/** Trade side sent by the client over the WebSocket. */
export type TradeAction = 'BUY' | 'SELL';

// ─────────────────────────────────────────────────────────────────────────
// REST — GET /api/crypto/prices
// ─────────────────────────────────────────────────────────────────────────

/**
 * ⚠️ Not yet re-verified against real REST traffic (only the WS `init`
 * message's `coins` field has been confirmed live — see CoinInitMeta
 * below, which has more fields: startPrice, minPrice, volatility). Confirm
 * whether the REST response matches this shape or the richer WS one when
 * TC-CRY-API-001 is implemented.
 */
export interface CoinMeta {
  name: string;
  pair: string; // e.g. "BTC/USD"
  icon: string; // emoji/symbol, e.g. "₿"
}

export interface PricesResponse {
  prices: Record<CryptoSymbol, number>;
  coins: Record<CryptoSymbol, CoinMeta>;
}

// ─────────────────────────────────────────────────────────────────────────
// REST — GET /api/crypto/profile
// ─────────────────────────────────────────────────────────────────────────

export interface HoldingEntry {
  symbol: CryptoSymbol;
  balance: number;
  price: number;
  value: number;
  pnl: number;
}

/**
 * A single entry in `profile.orders` (REST) — kept distinct from the WS
 * `order_filled.order` shape (OrderFilledMessage below) since the two are
 * not confirmed to match field-for-field. `id` now has real evidence of
 * its format from WS (`TRD-<timestamp>`) — confirm the REST shape carries
 * the same field name/format when TC-CRY-API-003 is implemented.
 */
export interface TradeRecord {
  id?: string;
  action: TradeAction;
  symbol: CryptoSymbol;
  amount: number;
  price: number;
  cost: number;
  timestamp?: string | number;
}

export interface ProfileResponse {
  balance_usd: number;
  portfolio_value: number;
  pnl_total: number;
  holdings: HoldingEntry[];
  orders: TradeRecord[];
  total_trades: number;
}

// ─────────────────────────────────────────────────────────────────────────
// REST — POST /api/crypto/inject
// ─────────────────────────────────────────────────────────────────────────

export interface InjectRequestParams {
  symbol: CryptoSymbol;
  direction: PriceDirection;
  /** Seconds, 1-60. Server-side cap is documented but unconfirmed above 60 — see TC-CRY-API-012. */
  duration?: number;
}

export interface InjectResponse {
  symbol: CryptoSymbol;
  direction: PriceDirection;
  duration: number;
  message: string;
  endsAt: string; // ISO timestamp
}

// ─────────────────────────────────────────────────────────────────────────
// REST — POST /api/crypto/reset
// ─────────────────────────────────────────────────────────────────────────

export interface ResetResponse {
  message?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────
// WebSocket — Server → Client messages
// ─────────────────────────────────────────────────────────────────────────

/**
 * CONFIRMED live (see crash-diagnostics.spec.ts output). Sent once,
 * immediately after connecting — full portfolio + market snapshot.
 */
export interface CoinInitMeta {
  symbol: CryptoSymbol;
  name: string;
  pair: string;
  startPrice: number;
  minPrice: number;
  volatility: number;
  icon: string;
}

export interface PriceHistoryPoint {
  price: number;
  timestamp: number;
}

export interface InitMessage {
  type: 'init';
  username: string;
  coins: Record<CryptoSymbol, CoinInitMeta>;
  coinSymbols: CryptoSymbol[];
  state: {
    balance_usd: number;
    balances: Record<CryptoSymbol, number>;
    orders: unknown[]; // shape not yet confirmed with non-empty orders — tighten once observed
  };
  prices: Record<CryptoSymbol, number>;
  /** ~300 points per coin. Large — always truncate before logging (see crash-diagnostics.spec.ts truncateForLog). */
  history: Record<CryptoSymbol, PriceHistoryPoint[]>;
}

/**
 * CONFIRMED live. One PER COIN, not bundled — a "tick round" is really a
 * cluster of ~4 of these arriving with (near-)identical timestamps.
 */
export interface PriceTickMessage {
  type: 'price';
  symbol: CryptoSymbol;
  price: number;
  timestamp: number;
  pattern: 'bull_flag' | 'channel_up' | 'random' | string;
  injected: PriceDirection | null;
}

/** CONFIRMED live. Acknowledges a qa_control action was received. */
export interface QaAckMessage {
  type: 'qa_ack';
  action: string;
  value: unknown;
}

/**
 * CONFIRMED live for a successful BUY. Real order ID format: `TRD-<epoch_ms>`.
 * The shape for a REJECTED order is still NOT confirmed — see the file-level
 * doc comment above.
 */
export interface OrderFilledMessage {
  type: 'order_filled';
  order: {
    id: string;
    symbol: CryptoSymbol;
    action: TradeAction;
    amount: number;
    price: number;
    timestamp: number;
    cost: number;
  };
  state: {
    balance_usd: number;
    balances: Record<CryptoSymbol, number>;
  };
}

/**
 * Catch-all for any WS message shape not yet confirmed against the live
 * server (e.g. the still-unknown rejected-order shape). Prefer widening
 * the union above as real behavior is confirmed, rather than assuming one.
 */
export interface UnknownServerMessage {
  type: string;
  [key: string]: unknown;
}

export type CryptoServerMessage =
  | InitMessage
  | PriceTickMessage
  | QaAckMessage
  | OrderFilledMessage
  | UnknownServerMessage;

// ─────────────────────────────────────────────────────────────────────────
// WebSocket — Client → Server messages
// ─────────────────────────────────────────────────────────────────────────

export interface TradeOrderMessage {
  action: TradeAction;
  symbol: CryptoSymbol;
  /**
   * Typed as `number | string` deliberately: TC-CRY-WS-008 / TC-CRY-CHAOS-011
   * require sending a string value (e.g. "five") to probe the platform's
   * documented type-validation bug. Production-path callers should always
   * pass a `number`.
   */
  amount: number | string;
}

/**
 * Known QA Control Panel actions confirmed over the WS channel:
 *   - 'set_latency' — confirmed, triggers a qa_ack, then a ~3s delay on trades.
 *   - 'crash'       — confirmed (NOT 'simulate_crash', which is a no-op),
 *                     closes the connection with no qa_ack.
 * Other panel actions (malformed-amount shortcuts, rapid fire, price
 * injection) are exercised directly via TradeOrderMessage / REST /inject
 * rather than through this generic control channel — see
 * docs/CRYPTO_CHAOS_TESTING_PLAN.md §3.
 */
export type QaControlAction = 'set_latency' | 'crash' | string;

export interface QaControlMessage {
  type: 'qa_control';
  action: QaControlAction;
  value: unknown;
}

export type CryptoClientMessage = TradeOrderMessage | QaControlMessage;