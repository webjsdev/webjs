/**
 * Cross-environment shim for @floating-ui/dom.
 *
 * Why: webjs's browser auto-vendor wraps CJS packages and emits only a
 * `default` export. Components that `import { computePosition, … }` from
 * '@floating-ui/dom' break in the browser bundle. Server-side (Node ESM)
 * the package provides proper named exports, so the same component file
 * has two different module shapes to deal with.
 *
 * This shim picks whichever shape is present at runtime and re-exports
 * the surface the components use. The website's `copy-registry.js`
 * rewrites `@floating-ui/dom` imports in copied component files to point
 * here.
 */
import * as raw from '@floating-ui/dom';

const lib: any =
  // Node ESM — named exports are direct namespace members
  (raw as any).computePosition
    ? raw
    // Browser auto-vendor — only `default` is exported
    : (raw as any).default ?? raw;

export const computePosition = lib.computePosition;
export const flip = lib.flip;
export const shift = lib.shift;
export const offset = lib.offset;
export const autoUpdate = lib.autoUpdate;
export const arrow = lib.arrow;
export const hide = lib.hide;
export const size = lib.size;
export const inline = lib.inline;
export const limitShift = lib.limitShift;
export const detectOverflow = lib.detectOverflow;
export const platform = lib.platform;
