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

test('hover-card tap toggles + ALWAYS blocks nav on touch; no-op on hover (#745)', () => {
  const t = new UiHoverCardTrigger();
  let opened = 0;
  const card = { open: false, openByTouch: () => { opened++; card.open = true; } };
  t.closest = () => /** @type {any} */ (card);
  const mkEvt = () => { const e = { p: 0, preventDefault() { e.p++; }, stopPropagation() {} }; return e; };

  /** @type {any} */ (globalThis).window = { matchMedia: () => ({ matches: true }) };

  // Closed -> first tap opens the card and blocks the link navigation.
  const e1 = mkEvt();
  t._onClick(/** @type {any} */ (e1));
  assert.equal(card.open, true, 'tap opens a closed card');
  assert.equal(opened, 1);
  assert.equal(e1.p, 1, 'blocks the link navigation when opening');

  // Open -> a re-tap toggles it closed and STILL preventsDefault, so the inner
  // <a>'s click never reaches the client router (no pushState, no history
  // pollution that needs N Back presses) (#745).
  const e2 = mkEvt();
  t._onClick(/** @type {any} */ (e2));
  assert.equal(card.open, false, 'a re-tap toggles the card closed (never navigates)');
  assert.equal(e2.p, 1, 'still blocks nav while open, so the router never pushState');

  // Hover device (desktop): handler is a no-op, the link navigates normally.
  card.open = false;
  /** @type {any} */ (globalThis).window = { matchMedia: () => ({ matches: false }) };
  const e3 = mkEvt();
  t._onClick(/** @type {any} */ (e3));
  assert.equal(e3.p, 0, 'on a hover device the inner link still navigates');
});
