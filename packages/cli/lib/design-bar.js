// The design bar the scaffold sets (AGENTS.md / CONVENTIONS.md item 6): a
// delivered UI app must have its OWN design, not the scaffold's. The scaffold is
// a teaching artifact for how to USE the framework, never a starting design.
// This lives in one place so the `--clear-placeholders` reminder and the
// `webjs doctor` advisory speak with one voice (the clear command strips the
// layout marker that carried this reminder just-in-time, so it is re-surfaced
// there, and doctor catches an app that kept the shell anyway).

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * True when the app has a root layout, i.e. it is a UI app the design bar
 * applies to. The `api` template ships no `app/layout`, so the reminder /
 * advisory stay quiet there.
 * @param {string} appDir
 * @returns {boolean}
 */
export function hasUiLayout(appDir) {
  return ['ts', 'js', 'mts', 'mjs'].some((e) => existsSync(join(appDir, 'app', `layout.${e}`)));
}

export const DESIGN_REMINDER =
  '\nDesign: the scaffold shell is a TEACHING artifact, not a starting design.\n' +
  'A delivered UI app must have its OWN design chosen from what the app IS:\n' +
  'layout, palette, typography, icons, spacing, and chrome. Do not keep the\n' +
  "scaffold's header / Home nav / theme-toggle / ~760px reading column / its\n" +
  'attribution footer, and recoloring is not a redesign. Decide from scratch\n' +
  'what layout fits (a centered board, a full-bleed dashboard, a split, a single\n' +
  'card), then render the app and look at it before calling it done. See\n' +
  'AGENTS.md / CONVENTIONS.md item 6.';

// Distinctive strings the scaffold emits into `app/layout.ts`. An app that still
// carries several of them kept the scaffold shell rather than designing its own.
// Each is scaffold-authored default chrome (not something a bespoke design would
// reproduce verbatim), so counting them is an objective proxy for "unchanged
// shell" without judging taste. `--header-h` + `theme-toggle` are the scaffold's
// fixed-header + theme-picker artifacts, `max-w-[760px]` is its reading column,
// and the attribution string is its footer.
const SHELL_TELLS = [
  { key: 'reading-column (max-w-[760px])', re: /max-w-\[760px\]/ },
  { key: 'theme-toggle chrome', re: /theme-toggle/ },
  { key: 'fixed-header --header-h artifact', re: /--header-h\b/ },
  // Specific to the scaffold's own attribution (its footer links webjs.dev and
  // says "Built with webjs"). A bare "Built with ..." is a common bespoke footer,
  // so it is NOT a tell on its own.
  { key: 'attribution footer', re: /webjs\.dev|Built with webjs/ },
];

/**
 * The scaffold-shell tells present in a root-layout source string. Two or more
 * is a strong signal the app kept the scaffold chrome instead of designing its
 * own. Returns the human-readable keys that matched.
 * @param {string} layoutSrc
 * @returns {string[]}
 */
export function scaffoldShellTells(layoutSrc) {
  if (typeof layoutSrc !== 'string' || !layoutSrc) return [];
  return SHELL_TELLS.filter((t) => t.re.test(layoutSrc)).map((t) => t.key);
}
