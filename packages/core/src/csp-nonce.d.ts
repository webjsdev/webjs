/** Per-request CSP nonce provider (#259). Server-side; the browser bundle drops setCspNonceProvider. */
export function setCspNonceProvider(fn: () => string): void;
export function cspNonce(): string;
