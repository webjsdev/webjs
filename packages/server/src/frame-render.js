/**
 * Server-side `<webjs-frame>` subtree extraction (#253).
 *
 * When a `<webjs-frame src loading>` self-loads (or a click drives a frame
 * nav), the client sends an `x-webjs-frame: <id>` header and then, from the
 * response, applies ONLY the matching `<webjs-frame id>` subtree (the rest of
 * the page is discarded). Rendering the FULL page just to throw away all but
 * one region wastes the full-page render + transfer cost.
 *
 * This module extracts the requested frame subtree from the already-rendered
 * full-page HTML and returns ONLY that, so the response is BYTE-EQUIVALENT by
 * construction to what the client would have extracted from the full page (a
 * `src` self-load and a click-driven frame nav therefore produce identical DOM)
 * while sending far fewer bytes. "Isolable" means the requested frame id is
 * present in the rendered output; when it is not, the caller falls back to the
 * full-page render (so an auth redirect / a route that dropped the frame is
 * handled exactly as before).
 *
 * The extraction is a structural scan over the rendered HTML, balancing nested
 * `<webjs-frame>` tags so a frame nested inside another frame is matched
 * correctly. It only triggers when the `x-webjs-frame` header is present, so a
 * normal full-page request is completely unaffected (byte-identical).
 */

const FRAME_TAG = 'webjs-frame';

/**
 * Read the requested frame id off a request's `x-webjs-frame` header.
 * Returns the trimmed id, or `null` when the header is absent / empty (the
 * normal full-page request path).
 *
 * @param {Request | undefined} req
 * @returns {string | null}
 */
export function requestedFrameId(req) {
  if (!req || !req.headers) return null;
  const raw = req.headers.get('x-webjs-frame');
  if (!raw) return null;
  const id = raw.trim();
  return id ? id : null;
}

/**
 * Find the `<webjs-frame ... id="<frameId>" ...>...</webjs-frame>` subtree in
 * `html` and return it verbatim (opening tag through matching close tag), so
 * the slice is byte-equivalent to the same bytes inside the full page. Nested
 * `<webjs-frame>` tags are balanced, so an outer frame's close is not mistaken
 * for an inner frame's. Returns `null` when no frame with that id is present
 * (the caller then renders / returns the full page).
 *
 * The id match is attribute-aware (it reads the `id` attribute of each opening
 * `<webjs-frame>` tag rather than substring-matching), so a frame whose id is a
 * prefix of another id is not mismatched. A self-closing `<webjs-frame/>` (no
 * children) is matched as an empty subtree.
 *
 * @param {string} html  The rendered full-page HTML.
 * @param {string} frameId  The requested frame id.
 * @returns {string | null}  The frame subtree, or null when absent.
 */
export function extractFrameSubtree(html, frameId) {
  if (typeof html !== 'string' || !frameId) return null;
  const lower = html.toLowerCase();
  const open = '<' + FRAME_TAG;
  let cursor = 0;
  while (cursor < lower.length) {
    const start = lower.indexOf(open, cursor);
    if (start === -1) return null;
    // Confirm this is a real tag open (`<webjs-frame` followed by whitespace,
    // `>`, or `/`), not a longer tag name that happens to share the prefix.
    const after = lower[start + open.length];
    if (after !== undefined && after !== ' ' && after !== '\t' && after !== '\n'
        && after !== '\r' && after !== '>' && after !== '/') {
      cursor = start + open.length;
      continue;
    }
    // Locate the end of this opening tag.
    const tagEnd = html.indexOf('>', start);
    if (tagEnd === -1) return null;
    const openTag = html.slice(start, tagEnd + 1);
    const selfClosing = /\/\s*>$/.test(openTag);
    const id = readIdAttr(openTag);
    if (id === frameId) {
      if (selfClosing) return openTag;
      const end = findMatchingClose(html, lower, tagEnd + 1);
      if (end === -1) return null;
      return html.slice(start, end);
    }
    cursor = tagEnd + 1;
  }
  return null;
}

/**
 * Read the `id` attribute value out of a single opening `<webjs-frame ...>`
 * tag string. Handles double-quoted, single-quoted, and unquoted forms.
 *
 * @param {string} openTag  The opening tag including `<` and `>`.
 * @returns {string | null}
 */
function readIdAttr(openTag) {
  const m = /\sid\s*=\s*("([^"]*)"|'([^']*)'|([^\s>/]+))/i.exec(openTag);
  if (!m) return null;
  return m[2] ?? m[3] ?? m[4] ?? null;
}

/**
 * Given the index just past a `<webjs-frame ...>` opening tag, return the index
 * just past its matching `</webjs-frame>`, balancing nested `<webjs-frame>`
 * opens. Returns -1 when unbalanced (no matching close).
 *
 * @param {string} html  Original-case HTML (returned-slice source).
 * @param {string} lower  Lower-cased copy for case-insensitive scanning.
 * @param {number} from  Index just past the opening tag's `>`.
 * @returns {number}  Index just past the matching `</webjs-frame>`, or -1.
 */
/**
 * Find the next `needle` (`<webjs-frame` or `</webjs-frame`) in `lower` from
 * `start` that is a REAL tag, i.e. the char right after the tag name is a tag
 * boundary (whitespace, `>`, or `/`). This skips a prefix-collision tag such as
 * `<webjs-frame-nav>` / `</webjs-frame-nav>`, which `indexOf` alone would match
 * and miscount (an unbalanced one would corrupt the depth scan). Returns -1
 * when no real tag remains.
 *
 * @param {string} lower
 * @param {string} needle
 * @param {number} start
 * @returns {number}
 */
function findRealTag(lower, needle, start) {
  let at = start;
  while (at < lower.length) {
    const idx = lower.indexOf(needle, at);
    if (idx === -1) return -1;
    const after = lower[idx + needle.length];
    if (after === undefined || after === ' ' || after === '\t' || after === '\n'
      || after === '\r' || after === '>' || after === '/') {
      return idx;
    }
    at = idx + needle.length; // a prefix-collision tag, keep scanning
  }
  return -1;
}

function findMatchingClose(html, lower, from) {
  const open = '<' + FRAME_TAG;
  const close = '</' + FRAME_TAG;
  let depth = 1;
  let i = from;
  while (i < lower.length) {
    const nextOpen = findRealTag(lower, open, i);
    const nextClose = findRealTag(lower, close, i);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      // A nested frame open. Skip past its opening tag, and only increase
      // depth when it is NOT self-closing (a self-closing nested frame opens
      // and closes in one tag, so it does not need a matching close).
      const tagEnd = html.indexOf('>', nextOpen);
      if (tagEnd === -1) return -1;
      const nestedOpenTag = html.slice(nextOpen, tagEnd + 1);
      if (!/\/\s*>$/.test(nestedOpenTag)) depth++;
      i = tagEnd + 1;
      continue;
    }
    // A close tag. Consume through its `>`.
    const closeEnd = html.indexOf('>', nextClose);
    if (closeEnd === -1) return -1;
    depth--;
    i = closeEnd + 1;
    if (depth === 0) return i;
  }
  return -1;
}
