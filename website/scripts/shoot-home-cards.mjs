/**
 * Regenerate public/images/home-cards-{light,dark}.png, the picture of the
 * /ui home page's card grid that the page shows below md, where shadcn shows
 * its full-light.png and full-dark.png.
 *
 * Manual dev tool, not part of the build or deploy. Start the site, then:
 *
 *   node scripts/shoot-home-cards.mjs [http://localhost:5001]
 *
 * It frames the grid as shadcn's picture does: three columns (a 1280px wide
 * page, at twice the pixel density), from the top of the grid down 1382px,
 * once per theme. Needs playwright. The committed files were then reduced
 * to 256 colours (about half the bytes, no visible change):
 *
 *   magick home-cards-light.png -dither None -colors 256 PNG8:home-cards-light.png
 */
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5001';
const out = (theme) => resolve(import.meta.dirname, '..', 'public', 'images', `home-cards-${theme}.png`);

const browser = await chromium.launch();
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 2, colorScheme: theme });
    await page.goto(`${base}/ui`, { waitUntil: 'load' });
    // The chat card streams its first answer in; let it settle.
    await page.waitForTimeout(1500);
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    const demo = page.locator('[data-slot=demo]');
    await page.evaluate(() => document.fonts.ready);
    const box = await demo.boundingBox();
    if (!box) throw new Error('no card grid on /ui');
    await page.screenshot({ path: out(theme), clip: { x: box.x, y: box.y + (await page.evaluate(() => scrollY)), width: box.width, height: 1382 }, fullPage: true });
    await page.close();
    console.log(`wrote ${out(theme)}`);
  }
} finally {
  await browser.close();
}
