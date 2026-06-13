/** Client action-abort plumbing (#492). Inert server-side. */
export function setActiveActionSignal(signal: AbortSignal | null): void;
export function activeActionSignal(): AbortSignal | undefined;
