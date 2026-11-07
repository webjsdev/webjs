/**
 * A switch's thumb stays in its track under `dir="rtl"` (#1666). The thumb
 * starts at the inline start, which is the right in RTL, and the styles move
 * it with a horizontal translate, which has no logical form. shadcn's install
 * transform gives each such translate an `rtl:` twin that negates it, and the
 * kit's port now does the same, so under RTL a checked thumb slides left
 * rather than off the track to the right. Checked with the real /ui
 * stylesheets and the site's copy of the kit's switch.
 */
import '/modules/ui/components/switch.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg); },
};

const tick = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

suite('a switch thumb stays inside its track in either direction', () => {
  suiteSetup(async () => {
    for (const href of ['/public/ui.css', '/public/ui-styles/nova.css', '/public/ui-styles/new-york.css']) {
      if (document.querySelector(`link[href="${href}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      const loaded = new Promise((resolve, reject) => { link.onload = resolve; link.onerror = reject; });
      document.head.appendChild(link);
      await loaded;
    }
  });

  for (const style of ['nova', 'new-york']) {
    for (const dir of ['ltr', 'rtl']) {
      test(`style-${style}, dir=${dir}: the thumb sits at the inline end when checked and the start when not`, async () => {
        const root = document.createElement('div');
        root.className = 'ui-site';
        root.innerHTML = `<div class="style-${style}" dir="${dir}">
          <ui-switch checked aria-label="On"></ui-switch>
          <ui-switch aria-label="Off"></ui-switch>
        </div>`;
        document.body.appendChild(root);
        try {
          await tick();
          // No transition, so the translate is read at its end state.
          for (const t of root.querySelectorAll('[data-slot="switch-thumb"]')) t.style.transition = 'none';
          await tick();
          const [on, off] = [...root.querySelectorAll('[data-slot="switch"]')].map((track) => ({
            track: track.getBoundingClientRect(),
            thumb: track.querySelector('[data-slot="switch-thumb"]').getBoundingClientRect(),
          }));
          for (const [name, s] of [['checked', on], ['unchecked', off]]) {
            assert.ok(s.thumb.left >= s.track.left - 0.5 && s.thumb.right <= s.track.right + 0.5,
              `${name}: thumb ${s.thumb.left}..${s.thumb.right} inside track ${s.track.left}..${s.track.right}`);
          }
          // Each thumb's offset from its own track's left edge.
          const at = (s) => s.thumb.left - s.track.left;
          const endward = dir === 'rtl' ? at(on) < at(off) : at(on) > at(off);
          assert.ok(endward, `checked moves toward the inline end (${at(on)} vs ${at(off)})`);
        } finally {
          root.remove();
        }
      });
    }
  }
});
