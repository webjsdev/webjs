/**
 * `<html>` and `<body>` attributes follow the server across a soft navigation
 * (#1686). The root layout owns them (`<html class=${theme}>`, `<body
 * class=...>`), and a Next.js developer expects a changed theme cookie to
 * show once the action or navigation lands, as it does when the root layout
 * re-renders there. The swap replaces content inside `<body>`, so without
 * this the attributes stayed as the first load left them until a reload.
 *
 * Only attributes the SERVER rendered are touched: the server lists their
 * names in `data-wj-html` / `data-wj-body`, so an attribute a script sets in
 * the browser (a theme bootstrap writing `data-theme` from localStorage) is
 * never removed. A response that did not render the root layout (a reduced
 * `X-Webjs-Have` fragment) carries no list and changes nothing.
 */

const MARKS = /** @type {const} */ ([['documentElement', 'data-wj-html'], ['body', 'data-wj-body']]);

/** @param {string | null} v */
const names = (v) => (v || '').split(/\s+/).filter(Boolean);

/**
 * Bring the live `<html>` and `<body>` attributes in line with an incoming
 * page's, for the attributes its server rendered.
 * @param {Document} doc the parsed incoming page
 */
export function syncRootAttributes(doc) {
  if (typeof document === 'undefined' || !doc) return;
  for (const [key, mark] of MARKS) {
    const incoming = /** @type {Element | null} */ (/** @type any */ (doc)[key]);
    const live = /** @type {Element | null} */ (/** @type any */ (document)[key]);
    if (!incoming || !live || !incoming.hasAttribute(mark)) continue;
    const next = names(incoming.getAttribute(mark));
    for (const n of names(live.getAttribute(mark))) {
      if (!next.includes(n)) live.removeAttribute(n);
    }
    for (const n of next) {
      const v = incoming.getAttribute(n);
      if (v === null) live.removeAttribute(n);
      else if (live.getAttribute(n) !== v) live.setAttribute(n, v);
    }
    live.setAttribute(mark, next.join(' '));
  }
}
