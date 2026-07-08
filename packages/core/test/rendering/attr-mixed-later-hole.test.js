// Regression: a multi-hole attribute (`class="a ${x} b ${y}"`) is anchored at
// its first hole; the later holes are `noop`. A re-render that changes ONLY a
// later hole must still rebuild the whole attribute. Before the fix, the change
// was dropped by updateInstance's per-hole dirty-check and the attribute went
// stale (dogfood #845: a tic-tac-toe cell kept a stale class when only the
// second class hole changed).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

before(() => {
  const { window } = parseHTML('<!doctype html><html><body></body></html>');
  globalThis.document = window.document;
  globalThis.DocumentFragment = window.DocumentFragment;
  globalThis.Node = window.Node;
  globalThis.Element = window.Element;
  globalThis.Comment = window.Comment;
  globalThis.Text = window.Text;
  globalThis.NodeFilter = window.NodeFilter;
  globalThis.HTMLElement = window.HTMLElement;
});

let html, render;
before(async () => {
  ({ html } = await import('../../src/html.js'));
  ({ render } = await import('../../src/render-client.js'));
});

const el = (a, b) => html`<i class="s ${a} ${b}"></i>`;

test('a change to only the LATER hole of a mixed attribute is applied', () => {
  const host = document.createElement('div');
  render(el('A1', 'B1'), host);
  assert.equal(host.querySelector('i').getAttribute('class'), 's A1 B1');

  // Only the second hole changes. Counterfactual: pre-fix this stayed "s A1 B1".
  render(el('A1', 'B2'), host);
  assert.equal(host.querySelector('i').getAttribute('class'), 's A1 B2');
});

test('a change to only the FIRST hole of a mixed attribute is applied', () => {
  const host = document.createElement('div');
  render(el('A1', 'B1'), host);
  render(el('A2', 'B1'), host);
  assert.equal(host.querySelector('i').getAttribute('class'), 's A2 B1');
});

test('mixed attribute with both holes changing rebuilds fully', () => {
  const host = document.createElement('div');
  render(el('A1', 'B1'), host);
  render(el('A2', 'B2'), host);
  assert.equal(host.querySelector('i').getAttribute('class'), 's A2 B2');
});

test('a THREE-hole attribute re-applies when the middle hole changes', () => {
  // Uses data-* (not class) with distinct multi-char statics so the assertion
  // reads the raw attribute value (a class token-set view would obscure it).
  const el = (a, b, c) => html`<i data-v="p ${a} q ${b} r ${c}"></i>`;
  const host = document.createElement('div');
  render(el('1', '2', '3'), host);
  assert.equal(host.querySelector('i').getAttribute('data-v'), 'p 1 q 2 r 3');
  // change ONLY the middle hole. Counterfactual: pre-fix stayed 'p 1 q 2 r 3'.
  render(el('1', '9', '3'), host);
  assert.equal(host.querySelector('i').getAttribute('data-v'), 'p 1 q 9 r 3');
  // change ONLY the last hole.
  render(el('1', '9', '8'), host);
  assert.equal(host.querySelector('i').getAttribute('data-v'), 'p 1 q 9 r 8');
});

test('an unkeyed fixed-length list patches each cell class independently', () => {
  // The board case: a length-9 list where per-item class holes change every
  // render. Positional reconcile plus the mixed-attr fix must keep each cell's
  // class correct (the winning-line highlight must land only on the won cells).
  const cell = (mark, win) =>
    html`<button class="base ${win ? 'is-win' : 'plain'} ${mark === '.' ? 'empty' : 'filled'}"></button>`;
  const view = (board, wins) =>
    html`<div>${Array.from({ length: 9 }, (_, i) => cell(board[i], wins.includes(i)))}</div>`;
  const host = document.createElement('div');
  render(view('.........', []), host);
  render(view('XX.OOOX..', [3, 4, 5]), host);
  const board = 'XX.OOOX..';
  const cells = [...host.querySelectorAll('button')];
  cells.forEach((btn, i) => {
    const cls = btn.getAttribute('class');
    assert.equal(cls.includes('is-win'), [3, 4, 5].includes(i), `cell ${i} win class`);
    assert.equal(cls.includes(board[i] === '.' ? 'empty' : 'filled'), true, `cell ${i} fill class`);
  });
});
