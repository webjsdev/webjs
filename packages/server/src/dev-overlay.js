/**
 * The dev error overlay renderer (#264), the BROWSER half of the dev error
 * overlay. It is a browser-safe ES module (no node imports) so it can be both
 * unit-tested in a real browser AND inlined verbatim into the served dev
 * reload client (`reloadClientJs` reads this file's source, strips the `export`
 * keywords, and embeds it). Sharing the one source means the test drives the
 * exact code that ships, with no drift.
 *
 * Security: the overlay is built with `createElement` + `textContent` only,
 * NEVER `innerHTML`, so a hostile error message / file path / code frame is
 * rendered as inert text and can never inject markup or script.
 */

/** The single live overlay element, or null. */
let __wjOverlay = null;

/** Remove the overlay if one is showing. */
export function dismissDevOverlay() {
  if (__wjOverlay) { __wjOverlay.remove(); __wjOverlay = null; }
}

/** Append a styled text row to `parent`. */
function __wjRow(parent, css, text) {
  const d = document.createElement('div');
  d.style.cssText = css;
  d.textContent = text;
  parent.appendChild(d);
  return d;
}

/**
 * Render the dev error overlay for a frame, replacing any prior one.
 * @param {{ kind?: string, message?: string, file?: string|null, line?: number|null, column?: number|null, codeFrame?: string|null, hint?: string|null }} f
 */
export function renderDevOverlay(f) {
  dismissDevOverlay();
  if (!f) return;
  const o = document.createElement('div');
  o.setAttribute('data-webjs-error-overlay', '');
  o.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(10,10,12,.92);color:#e6e6e6;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;padding:32px;overflow:auto';
  const card = document.createElement('div');
  card.style.cssText = 'max-width:920px;margin:0 auto;background:#1a1a1f;border:1px solid #5b2330;border-radius:8px;padding:24px';
  const kind = f.kind === 'ts-strip' ? 'TypeScript error (hydration is dead until fixed)' : f.kind === 'rebuild' ? 'Rebuild failed' : 'Server render error';
  __wjRow(card, 'color:#ff6b6b;font-weight:700;font-size:15px;margin-bottom:8px', kind);
  __wjRow(card, 'white-space:pre-wrap;margin-bottom:12px', f.message || '');
  if (f.file) __wjRow(card, 'color:#9aa3ad;margin-bottom:12px', f.file + (f.line ? ':' + f.line + (f.column ? ':' + f.column : '') : ''));
  if (f.codeFrame) {
    const pre = document.createElement('pre');
    pre.style.cssText = 'background:#0d0d10;border-radius:6px;padding:12px;overflow:auto;margin:0 0 12px;white-space:pre';
    pre.textContent = f.codeFrame;
    card.appendChild(pre);
  }
  if (f.hint) __wjRow(card, 'color:#ffd479;border-top:1px solid #333;padding-top:12px;white-space:pre-wrap', f.hint);
  const btn = document.createElement('button');
  btn.textContent = 'Dismiss';
  btn.style.cssText = 'margin-top:16px;background:#333;color:#eee;border:0;border-radius:4px;padding:6px 12px;cursor:pointer';
  btn.addEventListener('click', dismissDevOverlay);
  card.appendChild(btn);
  o.appendChild(card);
  (document.body || document.documentElement).appendChild(o);
  __wjOverlay = o;
}
