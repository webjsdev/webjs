/**
 * Regression tests for #745: hover-card and dropdown-menu submenu relied on
 * hover/pointer events that do not exist on touch, so on iOS the hover-card tap
 * fell through to the inner <a> (navigation) and the submenu only stayed open
 * while pressed. The fix gates the HOVER handlers on `pointerType !== 'touch'`
 * (leaving @click as the touch path) and adds a tap-to-open path to hover-card.
 *
 * These exercise the handlers directly with mock events, which is exactly the
 * pointer-type / no-hover branch the fix introduces (a full browser is not
 * needed to prove the guard; the e2e touch behaviour is verified separately).
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  UiDropdownMenuSubTrigger,
  UiDropdownMenuSub,
} from '../packages/registry/components/dropdown-menu.ts';
import { UiHoverCardTrigger } from '../packages/registry/components/hover-card.ts';

afterEach(() => {
  delete /** @type {any} */ (globalThis).window;
});

test('dropdown sub-trigger pointerenter hover-opens on mouse, not on touch (#745)', () => {
  const t = new UiDropdownMenuSubTrigger();
  let shown = 0;
  t._sub = () => /** @type {any} */ ({ show: () => { shown++; } });
  const evt = (pointerType) => ({ pointerType, currentTarget: { hasAttribute: () => false, focus() {} } });

  t._onPointerEnter(evt('touch'));
  assert.equal(shown, 0, 'touch pointerenter must NOT hover-open (the tap click opens it)');

  t._onPointerEnter(evt('mouse'));
  assert.equal(shown, 1, 'mouse pointerenter still hover-opens');
});

test('dropdown sub pointerleave schedules close on mouse, not on touch (#745)', () => {
  const s = new UiDropdownMenuSub();
  let scheduled = 0;
  s._scheduleClose = () => { scheduled++; };

  s._scheduleCloseHandler(/** @type {any} */ ({ pointerType: 'touch' }));
  assert.equal(scheduled, 0, 'touch pointerleave must NOT close a tap-opened submenu');

  s._scheduleCloseHandler(/** @type {any} */ ({ pointerType: 'mouse' }));
  assert.equal(scheduled, 1, 'mouse pointerleave still schedules close');
});

test('hover-card tap opens + blocks nav on a no-hover device; no-op on hover (#745)', () => {
  const t = new UiHoverCardTrigger();
  let opened = 0, prevented = 0;
  const card = { open: false, openByTouch: () => { opened++; } };
  t.closest = () => /** @type {any} */ (card);
  const mkEvt = () => ({ preventDefault: () => { prevented++; }, stopPropagation() {} });

  // No-hover device (touch): the tap opens the card and is prevented from
  // navigating the inner link.
  /** @type {any} */ (globalThis).window = { matchMedia: () => ({ matches: true }) };
  t._onClick(/** @type {any} */ (mkEvt()));
  assert.equal(opened, 1, 'tap on a no-hover device opens the card');
  assert.equal(prevented, 1, 'tap on a no-hover device blocks the link navigation');

  // Hover device (desktop): handler is a no-op, the link navigates normally.
  opened = 0; prevented = 0;
  /** @type {any} */ (globalThis).window = { matchMedia: () => ({ matches: false }) };
  t._onClick(/** @type {any} */ (mkEvt()));
  assert.equal(opened, 0, 'on a hover device the tap handler is a no-op');
  assert.equal(prevented, 0, 'on a hover device the inner link still navigates');
});
