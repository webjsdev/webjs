// The absolute path to the spawn pin preload (`bun-pin-preload.js`), WITHOUT
// importing it (importing would install the Bun.plugin onLoad in THIS process,
// which is not wanted in the cli that only needs the path to pass to a spawned
// `bun --preload`). Re-exported from `index.js` so the cli reads it off the
// already-loaded `@webjsdev/server` module (#704).
import { fileURLToPath } from 'node:url';

/** @type {string} absolute path to bun-pin-preload.js */
export const bunPinPreloadPath = fileURLToPath(new URL('./bun-pin-preload.js', import.meta.url));
