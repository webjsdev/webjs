import { listEntries } from '#modules/changelog/queries/list-entries.server.ts';
import { renderEntryBody } from '#modules/changelog/utils/render-entry.ts';
import { siteUrl } from '#lib/env.ts';

/**
 * GET /ui/rss.xml: the WebJs UI changelog as an RSS 2.0 feed, shadcn/ui's
 * apps/v4/app/rss.xml/route.ts (#1666). shadcn lists its docs changelog
 * pages; the entries here are the `@webjsdev/ui` releases
 * (changelog/ui/*.md), the ones /ui/docs/changelog shows, each linking to
 * its heading there (an older release, shown only as a card, links to the
 * page). The description is the entry's rendered notes.
 */

const TITLE = 'WebJs UI Changelog';
// /ui/docs/changelog shows this many releases in full, each under its own
// heading; an older one is only a card there, so its link is the page.
const NUMBER_OF_LATEST_PAGES = 5;
const DESCRIPTION = 'Accessible components for WebJs, built on native HTML and styled with Tailwind v4.';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** CDATA cannot hold its own terminator, so split one across two sections. */
function cdata(s: string): string {
  return `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

export async function GET() {
  const base = siteUrl();
  const entries = (await listEntries()).filter((e) => e.shortPkg === 'ui');
  const items = entries.map((e, i) => {
    const page = `${base}/ui/docs/changelog`;
    const link = i < NUMBER_OF_LATEST_PAGES ? `${page}#v${e.version.replace(/\./g, '-')}` : page;
    return `    <item>
      <title>${cdata(`${e.package} ${e.version}`)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">webjs-ui-${escapeXml(e.version)}</guid>
      <description>${cdata(renderEntryBody(e.body))}</description>
      <pubDate>${new Date(e.date).toUTCString()}</pubDate>
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${TITLE}</title>
    <link>${escapeXml(`${base}/ui`)}</link>
    <description>${escapeXml(DESCRIPTION)}</description>
    <language>en-us</language>
    <atom:link href="${escapeXml(`${base}/ui/rss.xml`)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
