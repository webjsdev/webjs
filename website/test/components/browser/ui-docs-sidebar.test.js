/**
 * Browser tests for <ui-docs-sidebar>, the /ui docs sidebar's active link and
 * scroll position (#1666, shadcn's DocsSidebar).
 *
 * /ui/docs/installation is linked twice: in Sections (a prefix match) and
 * under Get Started (exact). shadcn picks the longest active href and, on a
 * tie, the one nearest the middle, and scrolls only when that link is out of
 * view, so the page opens with the sidebar at the top. Picking the exact
 * match alone, as this element used to, scrolled to the second copy.
 */
import '#components/ui-docs-sidebar.ts';

const assert = {
  ok: (v, msg) => { if (!v) throw new Error(msg || `Expected truthy, got ${v}`); },
  equal: (a, b, msg) => { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
};

const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

suite('ui-docs-sidebar', () => {
  let original;

  setup(() => {
    original = location.pathname + location.search;
    try { sessionStorage.removeItem('docs-sidebar-scroll'); } catch {}
  });

  teardown(() => {
    history.replaceState(null, '', original);
    document.querySelectorAll('ui-docs-sidebar').forEach((el) => el.remove());
  });

  const link = (href, match, text) => `<li><a data-slot="sidebar-menu-button" href="${href}" data-match="${match}" data-active="false" style="display:block;height:30px">${text}</a></li>`;

  const mount = async (path, links) => {
    history.replaceState(null, '', path);
    const el = document.createElement('ui-docs-sidebar');
    el.innerHTML = `<nav data-docs-sidebar-content style="height:300px;overflow:auto">${links}</nav>`;
    document.body.appendChild(el);
    await el.updateComplete;
    await frame();
    return el;
  };

  const filler = Array.from({ length: 30 }, (_, i) => link(`/ui/docs/x${i}`, 'exact', `x${i}`)).join('');

  test('on a page in Sections and Get Started it stays on Sections, at the top', async () => {
    const el = await mount('/ui/docs/installation', `
      ${link('/ui/docs', 'exact', 'Introduction')}
      ${link('/ui/docs/installation', 'prefix', 'Installation')}
      ${filler}
      ${link('/ui/docs/installation', 'exact', 'Installation')}`);
    const scroller = el.querySelector('[data-docs-sidebar-content]');
    const [section, getStarted] = el.querySelectorAll('a[href="/ui/docs/installation"]');
    assert.equal(section.dataset.active, 'true', 'the Sections link is active');
    assert.equal(getStarted.dataset.active, 'true', 'so is the Get Started copy');
    assert.equal(getStarted.getAttribute('aria-current'), 'page', 'the exact copy is the current page');
    assert.equal(scroller.scrollTop, 0, 'a visible active link means no scroll');
  });

  test('a page below the fold is scrolled into the middle', async () => {
    const el = await mount('/ui/docs/x25', `${link('/ui/docs', 'exact', 'Introduction')}${filler}`);
    const scroller = el.querySelector('[data-docs-sidebar-content]');
    const target = el.querySelector('a[href="/ui/docs/x25"]');
    assert.ok(scroller.scrollTop > 0, 'scrolled');
    const box = scroller.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    assert.ok(r.top >= box.top && r.bottom <= box.bottom, 'the link is in view');
  });

  test('a sidebar scrolled on this page keeps that position on return', async () => {
    sessionStorage.setItem('docs-sidebar-scroll', JSON.stringify({ pathname: '/ui/docs/x2', scrollTop: 123 }));
    const el = await mount('/ui/docs/x2', `${link('/ui/docs', 'exact', 'Introduction')}${filler}`);
    assert.equal(el.querySelector('[data-docs-sidebar-content]').scrollTop, 123);
  });
});
