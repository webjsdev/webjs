export interface ConnectOptions {
  onOpen?: (ev: Event) => void;
  // `any`, matching the JSDoc, and load-bearing rather than lazy: the socket
  // delivers an arbitrary JSON payload, and the contract is that the CALLER
  // names the shape it expects (`(msg: ChatMessage) => ...`). Narrowing this to
  // `unknown` type-checks here and breaks every such handler, which is not a
  // change a PR filling in missing declarations gets to make.
  onMessage?: (data: any, ev: MessageEvent) => void;
  onClose?: (ev: CloseEvent) => void;
  onError?: (ev: Event) => void;
  protocols?: string | string[];
  reconnect?: boolean;
}

export interface WSConnection {
  send(data: string | ArrayBuffer | ArrayBufferView | object): void;
  close(code?: number, reason?: string): void;
  readonly socket: WebSocket | null;
  readonly readyState: 0 | 1 | 2 | 3;
}

/**
 * Open a managed WebSocket: a relative path is promoted to ws:// or wss://, it
 * reconnects with backoff unless `reconnect: false`, a string message that is
 * JSON arrives parsed, `send()` JSON-encodes an object and queues while
 * disconnected, and `close()` stops for good.
 *
 * @example
 * ```ts
 * // modules/chat/components/chat-feed.ts, fed by app/api/chat/route.ts (its WS export)
 * import { WebComponent, html, signal, connectWS, type WSConnection } from '@webjsdev/core';
 *
 * export class ChatFeed extends WebComponent {
 *   readonly #lines = signal<string[]>([]);
 *   #conn: WSConnection | null = null;
 *   connectedCallback() {   // browser only, so no socket opens during SSR
 *     super.connectedCallback();
 *     this.#conn = connectWS('/api/chat', { onMessage: (msg) => this.#lines.set([...this.#lines.get(), String(msg)]) });
 *   }
 *   disconnectedCallback() { super.disconnectedCallback(); this.#conn?.close(); }
 *   render() { return html`<ul>${this.#lines.get().map((line) => html`<li>${line}</li>`)}</ul>`; }
 * }
 * ChatFeed.register('chat-feed');
 * ```
 */
export function connectWS(url: string, opts?: ConnectOptions): WSConnection;
