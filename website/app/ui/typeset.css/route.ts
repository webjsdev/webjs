import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * GET /ui/typeset.css: shadcn/typeset's stylesheet as shadcn serves it at
 * /typeset.css, for the typeset builder's "Copy typeset.css" button and for
 * an agent following its prompt (#1666).
 *
 * The rules are public/ui-typeset.css, which the /ui docs already compile in,
 * so there is one copy of them. That file opens with the site's own comment;
 * this serves the body under shadcn's original header instead, which is the
 * file as a reader would download it from shadcn.
 */

const SOURCE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'ui-typeset.css');
const HEADER = '/*\n * shadcn/typeset\n * https://ui.shadcn.com/docs/typeset.\n */\n';

export async function GET() {
  const css = await readFile(SOURCE, 'utf8');
  // Drop the leading comment, keep everything after it unchanged.
  const body = css.replace(/^\/\*[\s\S]*?\*\/\n/, '');
  return new Response(HEADER + body, {
    headers: {
      'content-type': 'text/css; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
