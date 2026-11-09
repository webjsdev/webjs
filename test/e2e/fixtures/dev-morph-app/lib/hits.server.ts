/**
 * Module-scope state the in-place server refresh must keep (#1689): a counter
 * the page bumps on every render. No edit touches this file, so a server that
 * re-evaluates only the edited chain keeps counting, while a restarted one
 * starts over at 1.
 */
let n = 0;

export function hit(): number {
  return ++n;
}
