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
  '\nDesign: the scaffold is a TEACHING artifact, not a starting design.\n' +
  'A delivered UI app must have its OWN design chosen from what the app IS:\n' +
  'layout, palette, typography, icons, spacing, and chrome.\n' +
  '- Layout: app/layout.ts ships as a MINIMAL shell (no header / nav / footer /\n' +
  '  reading column). Design your own from what the app IS. LAYOUT-REFERENCE.md\n' +
  '  shows the mechanics; do not reproduce its example header verbatim.\n' +
  '- Palette: the design-token NAMES (--background, --primary, --card, ...) are\n' +
  '  infrastructure to keep, but their COLOR VALUES are yours. Set a distinctive\n' +
  '  palette that fits the app; keeping the starter orange is not a redesign.\n' +
  '- Verify by USING it: render the app and play through every state, and confirm\n' +
  '  nothing resizes or shifts as it fills (even, stable cells). A glance at the\n' +
  '  empty first paint is not enough; the layout bugs show up mid-interaction.\n' +
  'See AGENTS.md / CONVENTIONS.md item 6.';

// Distinctive strings that indicate an app kept scaffold-specific chrome or the
// unmodified starter palette, rather than designing its own. Counting them is an
// objective proxy for "did not own the design" without judging taste. NOTE: the
// theme apparatus (`--header-h`, the `theme-toggle` import) is KEEP-infrastructure
// the minimal shell ships in every app, so it is NOT a tell (it fired on every
// finished app and made the advisory nag forever). The tells that remain are
// genuine "reproduced the scaffold" signals: the exact 760px reading column, the
// scaffold's own attribution footer, and the two exact default palette VALUES (a
// verbatim match means the palette was never changed; a recolor does not match).
const SHELL_TELLS = [
  { key: 'reading-column (max-w-[760px])', re: /max-w-\[760px\]/ },
  // Specific to the scaffold's own attribution (its footer links webjs.dev and
  // says "Built with webjs"). A bare "Built with ..." is a common bespoke footer,
  // so it is NOT a tell on its own.
  { key: 'attribution footer', re: /webjs\.dev|Built with webjs/ },
  { key: 'default scaffold primary color', re: /--primary:\s*oklch\(0\.7\s+0\.16\s+52\)/ },
  { key: 'default scaffold card color', re: /--card:\s*oklch\(0\.18\s+0\.01\s+55\)/ },
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
