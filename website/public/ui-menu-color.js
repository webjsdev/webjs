/*
 * The /ui/create preview frame's menu surface (#1666), loaded by
 * app/ui/preview/[name]/page.ts.
 *
 * A translucent menu wears the style's `cn-menu-translucent` rule, which is a
 * class, so it has to be put on the element. shadcn's preview does it from a
 * MutationObserver (apps/v4/app/(app)/(create)/components/
 * design-system-provider.tsx), since a menu's content is rendered when it
 * opens; this is the same. It follows the design-system wrapper's
 * `data-menu-color`, which /ui/create rewrites in place. An inverted menu
 * needs no script: it is a CSS rule on the same attribute
 * (modules/ui/create/design-system.ts, menuColorCss).
 *
 * A static file rather than an inline script so the frame's page module stays
 * free of client work, and so a test can load the exact code the page runs.
 * The target list is MENU_TARGETS in design-system.ts; a test holds the two equal.
 */
(function () {
  var TARGETS = '.cn-menu-target, [data-slot="dropdown-menu-content"], [data-slot="dropdown-menu-sub-content"], [data-slot="context-menu-content"], [data-slot="context-menu-sub-content"], [data-slot="menubar-content"], [data-slot="menubar-sub-content"], [data-slot="select-content"], [data-slot="combobox-content"]';
  var root = document.querySelector('[data-slot="design-system"]');
  if (!root || root.__wjMenuColor) return;
  root.__wjMenuColor = true;
  var apply = function () {
    var on = /translucent$/.test(root.getAttribute('data-menu-color') || '');
    root.querySelectorAll(TARGETS).forEach(function (el) {
      if (on !== el.classList.contains('cn-menu-translucent')) el.classList.toggle('cn-menu-translucent', on);
    });
  };
  apply();
  new MutationObserver(apply).observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-menu-color', 'class'],
  });
})();
