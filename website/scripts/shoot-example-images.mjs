/**
 * Regenerate public/images/examples/<name>-{light,dark}.png, the pictures of
 * the /ui example apps that their pages show below md, where shadcn shows its
 * public/examples/<name>-{light,dark}.png instead of the live example.
 *
 * Manual dev tool, not part of the build or deploy. Start the site, then:
 *
 *   node scripts/shoot-example-images.mjs [http://localhost:5001] [name...]
 *
 * It frames each example as shadcn's pictures do: the example's frame on a
 * 1440px wide page at twice the pixel density, 1334px of it across (2668
 * pixels, shadcn's width) and as tall as shadcn's picture of that example
 * (EXAMPLE_IMAGES in modules/ui/example-apps/images.ts), once per theme. Needs
 * playwright. The committed files are then reduced to 256 colours, as the
 * home page's are:
 *
 *   magick dashboard-light.png -dither None -colors 256 PNG8:dashboard-light.png
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { EXAMPLE_IMAGES } from '../modules/ui/example-apps/images.ts';

const [baseArg, ...names] = process.argv.slice(2);
const base = baseArg ?? 'http://localhost:5001';
const dir = resolve(import.meta.dirname, '..', 'public', 'images', 'examples');
const wanted = Object.entries(EXAMPLE_IMAGES).filter(([name]) => !names.length || names.includes(name));

await mkdir(dir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const [name, [width, height]] of wanted) {
    for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1800 }, deviceScaleFactor: 2, colorScheme: theme });
      await page.goto(`${base}/ui/examples/${name}`, { waitUntil: 'load' });
      await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
      await page.evaluate(() => document.fonts.ready);
      // Let the elements upgrade and the chart's opening tooltip settle.
      await page.waitForTimeout(1500);
      const box = await page.locator('[data-example-frame]').boundingBox();
      if (!box) throw new Error(`no example frame on /ui/examples/${name}`);
      const y = box.y + (await page.evaluate(() => scrollY));
      const file = resolve(dir, `${name}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true, clip: { x: box.x, y, width: width / 2, height: height / 2 } });
      await page.close();
      console.log(`wrote ${file}`);
    }
  }
} finally {
  await browser.close();
}
