/**
 * Regenerate public/og.png, the 1200x630 social card.
 *
 * Manual dev tool, not part of the build or deploy. It renders an on-brand
 * dark card with headless Chromium (Playwright, resolved from the monorepo)
 * at 2x, then downscales to an exact 1200x630 with ImageMagick for crisp
 * text. Run it whenever the headline or look changes:
 *
 *   node scripts/generate-og.mjs
 *
 * Prerequisites: ImageMagick (the `magick` binary) on PATH, and playwright
 * resolvable from the monorepo (neither is a website dependency, since this is
 * a manual tool). The card mirrors the dark-theme design tokens declared in
 * app/layout.ts
 * (background, foreground, accent, the warm accent glow) and the hero
 * headline, so a regenerated card always matches the live site.
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const OUT = resolve(process.argv[2] || 'public/og.png');

// Dark-theme tokens, copied from the :root[data-theme='dark'] block in
// app/layout.ts so the card and the site stay in lockstep.
const T = {
  bg: 'oklch(0.155 0.012 55)',
  bgDeep: 'oklch(0.115 0.01 55)',
  fg: 'oklch(0.95 0.012 70)',
  fgMuted: 'oklch(0.74 0.02 65)',
  fgSubtle: 'oklch(0.56 0.02 60)',
  accent: 'oklch(0.74 0.15 55)',
  accentLive: 'oklch(0.63 0.17 50)',
  border: 'oklch(0.32 0.016 58 / 0.85)',
};

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500&family=JetBrains+Mono:wght@500&display=swap">
<style>
  *{ margin:0; padding:0; box-sizing:border-box; }
  html,body{ width:1200px; height:630px; }
  body{
    font-family:'Inter',system-ui,sans-serif;
    background:${T.bg};
    color:${T.fg};
    position:relative;
    overflow:hidden;
  }
  .glow{
    position:absolute; inset:0; pointer-events:none;
    background:
      radial-gradient(58% 50% at 50% -8%, color-mix(in oklch, ${T.accentLive} 26%, transparent), transparent 72%),
      radial-gradient(46% 42% at 90% 6%, color-mix(in oklch, ${T.accentLive} 20%, transparent), transparent 70%),
      radial-gradient(70% 60% at 50% 120%, ${T.bgDeep}, transparent 60%);
  }
  .frame{
    position:relative; z-index:1;
    width:100%; height:100%;
    padding:72px 76px;
    display:flex; flex-direction:column;
  }
  .brand{ display:flex; align-items:center; gap:16px; }
  .mark{
    width:46px; height:46px; border-radius:13px;
    background:linear-gradient(150deg, ${T.accent}, ${T.accentLive});
    box-shadow:0 6px 22px color-mix(in oklch, ${T.accentLive} 40%, transparent),
               inset 0 1px 0 color-mix(in oklch, white 30%, transparent);
  }
  .word{ font-family:'Inter Tight',sans-serif; font-weight:700; font-size:31px; letter-spacing:-0.02em; }
  .mid{ flex:1; display:flex; flex-direction:column; justify-content:center; }
  h1{
    font-family:'Inter Tight',sans-serif; font-weight:800;
    font-size:66px; line-height:1.05; letter-spacing:-0.035em;
    max-width:18ch;
  }
  .accent{
    white-space:nowrap;
    background:linear-gradient(105deg, ${T.accent}, color-mix(in oklch, ${T.accentLive} 72%, ${T.fg}));
    -webkit-background-clip:text; background-clip:text; color:transparent;
  }
  p.lede{
    margin-top:26px; max-width:30ch;
    font-size:25px; line-height:1.5; color:${T.fgMuted};
  }
  .foot{
    display:flex; align-items:center; justify-content:space-between;
    font-family:'JetBrains Mono',monospace; font-weight:500;
    font-size:15px; letter-spacing:0.04em; color:${T.fgSubtle};
  }
  .foot .tags{ display:flex; align-items:center; gap:10px; text-transform:uppercase; }
  .dot{ width:7px; height:7px; border-radius:50%; background:${T.accent}; }
  hr{ border:0; border-top:1px solid ${T.border}; margin-bottom:24px; }
</style></head>
<body>
  <div class="glow"></div>
  <div class="frame">
    <div class="brand"><div class="mark"></div><div class="word">webjs</div></div>
    <div class="mid">
      <h1>The framework your <span class="accent">AI agent</span> already knows how to use</h1>
      <p class="lede">AI‑first, web‑components‑first, no‑build. Native web components, server actions, streaming SSR, on web standards.</p>
    </div>
    <div>
      <hr>
      <div class="foot">
        <div class="tags"><span class="dot"></span>AI-FIRST &nbsp;&middot;&nbsp; WEB-COMPONENTS-FIRST &nbsp;&middot;&nbsp; NO BUILD</div>
        <div>github.com/webjsdev/webjs</div>
      </div>
    </div>
  </div>
</body></html>`;

const tmp = mkdtempSync(join(tmpdir(), 'webjs-og-'));
const big = join(tmp, 'og-2x.png');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: big, clip: { x: 0, y: 0, width: 1200, height: 630 } });
} finally {
  await browser.close();
}

// Downscale the 2400x1260 capture to an exact 1200x630 for crisp text.
execFileSync('magick', [big, '-resize', '1200x630', OUT], { stdio: 'inherit' });
rmSync(tmp, { recursive: true, force: true });
console.log('wrote', OUT);
