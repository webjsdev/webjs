/**
 * GET /ui/llms.txt
 *
 * The /ui section's own llms.txt (#1666), shadcn's public/llms.txt: every /ui
 * page with its description, linked to its markdown, then the example apps.
 * The docs sidebar's "llms.txt" entry links here. The site-wide /llms.txt
 * embeds the same two sections from the same builders, so the two cannot
 * list different pages.
 */
import { renderUiIndexSection, renderExamplesSection } from '#lib/ui/llm.server.ts';
import { originFor } from '#lib/docs-llms.server.ts';

export async function GET(req: Request): Promise<Response> {
  const origin = originFor(req);
  const [ui, examples] = await Promise.all([renderUiIndexSection(origin), renderExamplesSection(origin)]);
  const lines = [
    '# WebJs UI',
    '',
    '> Accessible components and blocks for WebJs apps, built on native HTML and styled with Tailwind v4. The source is copied into your app with `npx @webjsdev/ui add <name>` and is yours to edit. Open Source. Open Code.',
    '',
    `For the framework itself (routing, components, server actions, the CLI) read ${origin}/llms.txt, or ${origin}/llms-full.txt for every page of both in one file.`,
    '',
    // On its own the file has no "WebJs UI" section around these, so each
    // group is a top-level llms.txt section.
    ...ui.slice(2).map((l) => l.replace(/^### /, '## ')),
    '',
    ...examples.map((l) => l.replace(/^### /, '## ')),
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
    },
  });
}
