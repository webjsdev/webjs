import { html } from '@webjsdev/core';

/**
 * Shared, browser-safe link config for the site chrome (header + footer),
 * imported by both app/layout.ts and app/page.ts so the cross-app URLs and the
 * new-tab cue are declared once instead of duplicated across the two files.
 *
 * Sibling app URLs are read from env so the same code works across `webjs dev`
 * and any deployment target, guarded against `process` being undefined since
 * these modules also load on the client. Each falls back to its production
 * domain, and `.env` overrides it to the localhost dev port.
 */
const env = (globalThis as any).process?.env ?? {};

export const DOCS_URL = env.DOCS_URL || 'https://docs.webjs.com';
export const UI_URL = env.UI_URL || 'https://ui.webjs.dev';
// EXAMPLE_BLOG_URL points at the live example-blog app (a real webjs app), surfaced as
// the "Demo" nav link.
export const EXAMPLE_BLOG_URL = env.EXAMPLE_BLOG_URL || 'https://example-blog.webjs.dev';
export const GH_URL = 'https://github.com/webjsdev/webjs';

// Visually-hidden cue appended inside target="_blank" links so a screen reader
// announces the new-tab context change.
export const NEW_TAB = html`<span class="sr-only"> (opens in a new tab)</span>`;
