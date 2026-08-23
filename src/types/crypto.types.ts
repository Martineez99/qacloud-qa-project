/**
 * Crypto Simulator — Domain Types
 *
 * Reference: docs/CRYPTO_APP_CONTEXT.md §6 (API Reference)
 *            docs/CRYPTO_CHAOS_TESTING_PLAN.md §4.4 (WebSocket client helper)
 *
 * These types cover both the REST layer (/api/crypto/*) and the WebSocket
 * protocol (ws://<host>/ws/crypto). Unlike Market/Hotel, this app has no
 * Swagger-generated schema, so these types are derived directly from the
 * platform's own wiki documentation (docs/CRYPTO_APP_CONTEXT.md).
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
 * A single entry in `profile.orders`.
 *
 * NOTE: the platform's wiki does not document a distinct trade/order ID
 * field (see docs/CRYPTO_APP_CONTEXT.md, "Confirmation / Order ID Note").
 * `id` is marked optional here — confirm during TC-CRY-WS-003 implementation
 * whether the server actually returns one, and tighten this type once
 * confirmed.
 */
export interface TradeRecord {
  id?: string;
  action: TradeAction;
  symbol: CryptoSymbol;
  amount: number;
  price: number;
  cost: number;
  timestamp?: string;
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

/**
 * Exact response body is not fully documented by the wiki beyond a 200
 * success. Confirm and tighten this type during TC-CRY-API-005 implementation.
 */
export interface ResetResponse {
  message?: string;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────
// WebSocket — Server → Client messages
// ─────────────────────────────────────────────────────────────────────────

export interface TickMessage {
  type: 'tick';
  prices: Record<CryptoSymbol, number>;
  timestamp: number;
}

export interface TradeResultMessage {
  type: 'trade_result';
  success: boolean;
  action?: TradeAction;
  symbol?: CryptoSymbol;
  amount?: number;
  price?: number;
  cost?: number;
  balance_usd?: number;
  coin_balance?: number;
  /**
   * Populated when `success` is false. Exact shape/field name is NOT
   * confirmed by the wiki for the negative-amount / string-amount /
   * insufficient-funds cases (all three are documented as currently
   * FAILING on the platform — see docs/CRYPTO_APP_CONTEXT.md §11).
   * Keep this loose until the first real run confirms the actual shape.
   */
  error?: string;
}

/**
 * Catch-all for any WS message shape not yet confirmed against the live
 * server (e.g. a possible connection-level rejection instead of a
 * `trade_result` with `success: false`). Prefer widening this union as
 * real behavior is confirmed, rather than assuming a shape.
 */
export interface UnknownServerMessage {
  type: string;
  [key: string]: unknown;
}

export type CryptoServerMessage =
  | TickMessage
  | TradeResultMessage
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

/** Known QA Control Panel actions exposed over the WS channel. See docs/CRYPTO_APP_CONTEXT.md §4. */
export type QaControlAction = 'set_latency' | string;

export interface QaControlMessage {
  type: 'qa_control';
  action: QaControlAction;
  value: unknown;
}

export type CryptoClientMessage = TradeOrderMessage | QaControlMessage;
