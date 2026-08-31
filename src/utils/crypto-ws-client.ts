/**
 * Crypto Simulator — WebSocket Test Client
 *
 * Thin wrapper around the `ws` package used to connect, authenticate, send
 * trade/QA-control messages, and await specific server messages without
 * repeating boilerplate in every chaos test.
 *
 * Reference: docs/CRYPTO_CHAOS_TESTING_PLAN.md §4.4
 *            docs/CRYPTO_APP_CONTEXT.md §6.2 (WebSocket Protocol — corrected)
 *
 * Requires the `ws` package:
 *   npm install ws --save-dev
 *   npm install --save-dev @types/ws
 */

import WebSocket from 'ws';
import type {
  CryptoClientMessage,
  CryptoServerMessage,
  CryptoSymbol,
  QaControlAction,
  PriceTickMessage,
  TradeAction,
} from '../types/crypto.types';

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Thrown when `awaitMessage` / `awaitNTicks` do not receive a matching
 * message before the timeout elapses. Kept as a distinct error type so
 * tests can assert on "no such message arrived" scenarios explicitly
 * (e.g. confirming a malformed payload produced NO order outcome at all).
 */
export class CryptoWsTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CryptoWsTimeoutError';
  }
}

export interface CryptoWsClientOptions {
  /** Base WS URL, without querystring, e.g. "wss://www.qacloud.dev/ws/crypto". */
  wsUrl: string;
  /** API key used for trade authentication. Omit to test unauthenticated behavior (TC-CRY-WS-002/006). */
  apiKey?: string;
}

export class CryptoWsClient {
  private ws: WebSocket | null = null;
  private readonly messageLog: CryptoServerMessage[] = [];
  private readonly waiters: Array<{
    predicate: (msg: CryptoServerMessage) => boolean;
    resolve: (msg: CryptoServerMessage) => void;
  }> = [];
  private closedEventReceived = false;

  constructor(private readonly options: CryptoWsClientOptions) {}

  /** All messages received so far this connection, in arrival order. Useful for post-hoc assertions. */
  get history(): ReadonlyArray<CryptoServerMessage> {
    return this.messageLog;
  }

  /** Whether the underlying socket has received a `close` event (see TC-CRY-CHAOS-003). */
  get wasClosed(): boolean {
    return this.closedEventReceived;
  }

  /**
   * Opens the WebSocket connection. Per docs/CRYPTO_APP_CONTEXT.md §6.2,
   * the API key is passed as a query param on connect. The server responds
   * with an `init` message immediately (full snapshot) before any `price`
   * ticks — no special handling needed here, it just lands in `history`
   * like any other message; use `awaitInit()` if a test needs it explicitly.
   */
  connect(): Promise<void> {
    const url = this.options.apiKey
      ? `${this.options.wsUrl}?api_key=${encodeURIComponent(this.options.apiKey)}`
      : this.options.wsUrl;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.once('open', () => resolve());
      this.ws.once('error', (err) => reject(err));

      this.ws.on('message', (raw: WebSocket.RawData) => {
        let parsed: CryptoServerMessage;
        try {
          parsed = JSON.parse(raw.toString());
        } catch {
          // A non-JSON message is itself a finding worth capturing rather
          // than silently dropping — wrap it so awaiters can still inspect it.
          parsed = { type: '__unparseable__', raw: raw.toString() };
        }
        this.messageLog.push(parsed);
        this.dispatchToWaiters(parsed);
      });

      this.ws.on('close', () => {
        this.closedEventReceived = true;
      });
    });
  }

  /** Sends a BUY/SELL trade order. `amount` intentionally accepts non-numeric values for negative-path tests. */
  sendTrade(action: TradeAction, symbol: CryptoSymbol, amount: number | string): void {
    this.send({ action, symbol, amount });
  }

  /** Sends a QA Control Panel action directly over the socket (e.g. `set_latency`, `crash`). */
  sendQaControl(action: QaControlAction, value: unknown): void {
    this.send({ type: 'qa_control', action, value });
  }

  /** Sends an arbitrary raw payload — used for malformed-payload cases that don't fit the typed shapes (TC-CRY-WS-010/011) or protocol-discovery probes. */
  sendRaw(payload: unknown): void {
    this.requireConnection().send(JSON.stringify(payload));
  }

  private send(message: CryptoClientMessage): void {
    this.requireConnection().send(JSON.stringify(message));
  }

  private requireConnection(): WebSocket {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('CryptoWsClient: socket is not open. Call connect() first.');
    }
    return this.ws;
  }

  /**
   * Resolves with the first message matching `predicate`, considering only
   * messages at index >= `sinceIndex` in `history` (default 0 — the whole
   * log). Rejects with CryptoWsTimeoutError if none arrives within
   * `timeoutMs`.
   *
   * `sinceIndex` exists because several message types repeat (e.g. multiple
   * `order_filled` in one connection): without it, a second `awaitMessage`
   * call for the same predicate would immediately resolve with the FIRST,
   * now-stale match already sitting in history instead of waiting for a
   * new one. Pass `client.history.length` captured just before the
   * triggering action as `sinceIndex` whenever you expect a NEW occurrence
   * (see CryptoWsClient usage in websocket.spec.ts's measureTradeRoundTrip).
   *
   * Checking messageLog first (not just future messages) still avoids the
   * OTHER race — the message arriving between `send()` and `awaitMessage()`.
   */
  awaitMessage(
    predicate: (msg: CryptoServerMessage) => boolean,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    sinceIndex = 0,
  ): Promise<CryptoServerMessage> {
    const alreadyReceived = this.messageLog.slice(sinceIndex).find(predicate);
    if (alreadyReceived) {
      return Promise.resolve(alreadyReceived);
    }

    return new Promise((resolve, reject) => {
      const waiter = { predicate, resolve };
      this.waiters.push(waiter);

      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(waiter);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(
          new CryptoWsTimeoutError(
            `No message matching predicate arrived within ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      // Wrap resolve so the timer is always cleared, success or not.
      waiter.resolve = (msg) => {
        clearTimeout(timer);
        resolve(msg);
      };
    });
  }

  /** Awaits the one-time `init` snapshot message sent right after connecting. */
  awaitInit(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<CryptoServerMessage> {
    return this.awaitMessage((msg) => msg.type === 'init', timeoutMs);
  }

  /**
   * Awaits the next order-outcome message. CONFIRMED live: a successful
   * BUY/SELL arrives as `order_filled` (see OrderFilledMessage). The shape
   * for a REJECTED order is NOT yet confirmed, so this matches any `type`
   * starting with "order" as a safety net.
   *
   * Pass `sinceIndex` (e.g. `client.history.length` captured right before
   * sending the order) whenever this connection may already have an
   * earlier order outcome in its history — otherwise this will resolve
   * instantly with that stale match. See the `awaitMessage` doc comment.
   */
  awaitOrderOutcome(timeoutMs = DEFAULT_TIMEOUT_MS, sinceIndex = 0): Promise<CryptoServerMessage> {
    return this.awaitMessage(
      (msg) => typeof msg.type === 'string' && msg.type.startsWith('order'),
      timeoutMs,
      sinceIndex,
    );
  }

  /**
   * Awaits a `qa_ack` confirming a specific qa_control action was received
   * and applied — e.g. `awaitQaAck('set_latency')`. CONFIRMED live for
   * 'set_latency'. NOTE: NOT sent for 'crash' — that action closes the
   * connection directly with no ack, so callers triggering a crash should
   * await the connection closing instead (see `wasClosed`), not this method.
   *
   * Accepts `sinceIndex` for the same reason as `awaitOrderOutcome` — if a
   * test toggles the same qa_control action more than once per connection.
   */
  awaitQaAck(action: string, timeoutMs = DEFAULT_TIMEOUT_MS, sinceIndex = 0): Promise<CryptoServerMessage> {
    return this.awaitMessage(
      (msg) => msg.type === 'qa_ack' && (msg as { action?: string }).action === action,
      timeoutMs,
      sinceIndex,
    );
  }

  /**
   * Collects the next `n` PRICE tick messages (type: 'price'), counted from
   * the moment this is called (not from connection start). Each call
   * represents ONE coin's update, not all 4 bundled — see the file-level
   * protocol correction note in crypto.types.ts.
   */
  async awaitNTicks(n: number, timeoutMs = DEFAULT_TIMEOUT_MS * n): Promise<PriceTickMessage[]> {
    const collected: PriceTickMessage[] = [];

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(waiter);
        if (idx !== -1) this.waiters.splice(idx, 1);
        reject(
          new CryptoWsTimeoutError(
            `Only received ${collected.length}/${n} ticks within ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      const waiter = {
        predicate: (msg: CryptoServerMessage): boolean => {
          if (msg.type !== 'price') return false;
          collected.push(msg as PriceTickMessage);
          if (collected.length >= n) {
            clearTimeout(timer);
            const idx = this.waiters.indexOf(waiter);
            if (idx !== -1) this.waiters.splice(idx, 1);
            resolve(collected);
          }
          // Return false so this waiter is NOT removed by dispatchToWaiters
          // after a single match — we need it to keep collecting.
          return false;
        },
        resolve: () => {
          /* unused: this waiter resolves the outer promise manually above */
        },
      };

      this.waiters.push(waiter);
    });
  }

  private dispatchToWaiters(msg: CryptoServerMessage): void {
    // Iterate over a copy since predicate callbacks (e.g. awaitNTicks) may
    // mutate `this.waiters` while we're iterating.
    for (const waiter of [...this.waiters]) {
      const matched = waiter.predicate(msg);
      if (matched) {
        const idx = this.waiters.indexOf(waiter);
        if (idx !== -1) this.waiters.splice(idx, 1);
        waiter.resolve(msg);
      }
    }
  }

  /** Closes the connection. Safe to call even if already closed. */
  close(): void {
    this.ws?.close();
  }
}