/** Client-side SSR action-seed consumer (#472). Inert server-side. */

/** Returned by `takeSeed` when no seed matches; distinct from any real value. */
export const SEED_MISS: unique symbol;

/**
 * Merge any seeds found under `root` (or the whole document) into the global
 * consume-once store, removing the carriers. Reads the page-level
 * `#__webjs-seeds` JSON block and per-element `[data-webjs-seed]` carriers.
 */
export function scanSeeds(root?: ParentNode): void;

/**
 * Look up and CONSUME the seed for an action call, or return `SEED_MISS`.
 * Keyed `hash/fn/argsKey`; the first call lazily scans the initial document.
 */
export function takeSeed(hash: string, fnName: string, argsKey: string): unknown;
