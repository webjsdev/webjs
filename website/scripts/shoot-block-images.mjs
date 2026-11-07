/**
 * Regenerate public/images/blocks/<name>-{light,dark}.png, the picture of a
 * registry block that the /ui block viewer shows below lg and a docs page's
 * block preview below md, where shadcn shows its
 * /r/styles/new-york/<name>-{light,dark}.png (captured by its
 * scripts/capture-registry.mts).
 *
 * Manual dev tool, not part of the build or deploy. Start the site, then:
 *
 *   node scripts/shoot-block-images.mjs [http://localhost:5001] [name...]
 *
 * With no names it shoots every block the /ui/blocks pages list (the
 * registry's blocks less the charts and the configurator's preview boards),
 * at shadcn's 1440 by 900 viewport, once per theme. shadcn shoots at twice
 * the pixel density; once is enough for a picture shown at phone width, and
 * a quarter of the bytes. Needs playwright and ImageMagick, which reduces
 * each file to 256 colours (about half the bytes, no visible change).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const [base = 'http://localhost:5001', ...only] = process.argv.slice(2);
const root = resolve(import.meta.dirname, '..');
const dir = resolve(root, 'public', 'images', 'blocks');
mkdirSync(dir, { recursive: true });

const manifest = JSON.parse(readFileSync(resolve(root, '..', 'packages', 'ui', 'packages', 'registry', 'registry.json'), 'utf8'));
const names = only.length
  ? only
  : manifest.items
      .filter((it) => it.type === 'registry:block' && !(it.categories || []).some((c) => c === 'chart' || c === 'preview'))
      .map((it) => it.name);

const browser = await chromium.launch();
try {
  for (const name of names) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
      // A dev server restarts on every source change, so retry a refused load.
      for (let attempt = 1; ; attempt++) {
        try {
          await page.goto(`${base}/ui/view/${name}`, { waitUntil: 'load' });
          break;
        } catch (err) {
          if (attempt === 10) throw err;
          await page.waitForTimeout(2000);
        }
      }
      await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      await page.evaluate(() => document.fonts.ready);
      // Let the elements upgrade and the charts settle, as shadcn waits.
      await page.waitForTimeout(name.startsWith('dashboard') ? 1000 : 400);
      const out = resolve(dir, `${name}-${theme}.png`);
      await page.screenshot({ path: out });
      execFileSync('magick', [out, '-dither', 'None', '-colors', '256', `PNG8:${out}`]);
      await page.close();
      console.log(`wrote ${out}`);
    }
  }
} finally {
  await browser.close();
}
