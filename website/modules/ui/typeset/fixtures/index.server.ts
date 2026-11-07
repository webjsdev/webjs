/**
 * The typeset builder's specimens, ported from shadcn/ui's
 * apps/v4/app/(app)/(typeset)/lib/fixtures/ (#1666). The five content files
 * beside this one are shadcn's, byte for byte. shadcn also keeps recipe,
 * elements and tailwind fixtures, all commented out of its switcher, so they
 * are not carried here.
 *
 * The names and labels of the switch are in ../params.ts, so the builder's
 * element reads them without pulling these strings into the browser. This
 * index is a .server.ts module for the same reason: the specimens are only
 * ever rendered on the server, and the boundary keeps the preview page from
 * shipping them (the elision analyser reads a word like `window` in the
 * changelog's prose as client work).
 */
import { DOCS_HTML } from './docs.ts';
import { CHAT_HTML, CHAT_QUESTION } from './chat.ts';
import { ARTICLE_HTML } from './article.ts';
import { CHANGELOG_HTML } from './changelog.ts';
import { NOTES_HTML } from './notes.ts';
import type { ItemName } from '../params.ts';

export const FIXTURES: Record<ItemName, string> = {
  docs: DOCS_HTML,
  chat: CHAT_HTML,
  article: ARTICLE_HTML,
  changelog: CHANGELOG_HTML,
  notes: NOTES_HTML,
};

export { CHAT_QUESTION };
