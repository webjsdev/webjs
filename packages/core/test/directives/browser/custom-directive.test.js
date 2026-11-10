/**
 * Client twin of `../custom-directive.test.js`: lit's directive authoring API
 * on the client renderer. One instance per part across renders, `update()`
 * with a lit-shaped part, replacement on a class change, `setValue()` from an
 * AsyncDirective, and connection that follows the host component.
 */
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { WebComponent } from '../../../src/component.js';
import { keyed } from '../../../src/directives.js';
import { noChange } from '../../../src/sentinels.js';
import { directive, Directive, PartType } from '../../../src/directive.js';
import { AsyncDirective } from '../../../src/async-directive.js';

import { assert } from '../../../../../test/browser-assert.js';

const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '');
const tick = () => new Promise((r) => setTimeout(r, 0));

suite('custom directives (client)', () => {
  let container;
  setup(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });
  teardown(() => container.remove());

  test('a child directive keeps ONE instance across renders and gets update(part, values)', () => {
    const made = [];
    const seen = [];
    class Count extends Directive {
      constructor(info) { super(info); made.push(info); this.n = 0; }
      render(label) { return `${label}:${this.n}`; }
      update(part, [label]) {
        seen.push(part);
        this.n++;
        return this.render(label);
      }
    }
    const count = directive(Count);
    const view = (v) => html`<p>${count(v)}</p>`;
    render(view('a'), container);
    render(view('b'), container);
    assert.equal(strip(container.innerHTML), '<p>b:2</p>');
    assert.equal(made.length, 1, 'one instance for the part');
    assert.equal(made[0].type, PartType.CHILD);
    assert.equal(seen[0].type, PartType.CHILD);
    assert.equal(seen[0].parentNode, container.querySelector('p'));
  });

  test('a different directive class, or a plain value, replaces the instance', () => {
    let made = 0;
    class A extends Directive { constructor(i) { super(i); made++; } render() { return 'A'; } }
    class B extends Directive { constructor(i) { super(i); made++; } render() { return 'B'; } }
    const a = directive(A);
    const b = directive(B);
    const view = (v) => html`<p>${v}</p>`;
    render(view(a()), container);
    render(view(b()), container);
    assert.equal(strip(container.innerHTML), '<p>B</p>');
    render(view('plain'), container);
    render(view(a()), container);
    assert.equal(strip(container.innerHTML), '<p>A</p>');
    assert.equal(made, 3);
  });

  test('attribute, property, boolean and element parts get lit part info and a facade', () => {
    const infos = [];
    class Echo extends Directive {
      constructor(info) { super(info); infos.push(info); }
      update(part, [v]) { this.part = part; return v; }
      render(v) { return v; }
    }
    const echo = directive(Echo);
    const ref = directive(class extends Directive {
      update(part) { part.element.dataset.seen = 'yes'; return undefined; }
      render() { return undefined; }
    });
    render(html`<input title=${echo('t')} class="a ${echo('b')} c" .value=${echo('v')} ?disabled=${echo(true)} ${ref()}>`, container);
    const input = container.querySelector('input');
    assert.equal(input.getAttribute('title'), 't');
    assert.equal(input.getAttribute('class'), 'a b c');
    assert.equal(input.value, 'v');
    assert.equal(input.disabled, true);
    assert.equal(input.dataset.seen, 'yes');
    const types = infos.map((i) => i.type);
    assert.deepEqual(types, [PartType.ATTRIBUTE, PartType.ATTRIBUTE, PartType.PROPERTY, PartType.BOOLEAN_ATTRIBUTE]);
    assert.equal(infos[0].name, 'title');
    assert.equal(infos[0].tagName, 'INPUT');
    assert.deepEqual([...infos[1].strings], ['a ', ' c']);
  });

  test('noChange from a directive keeps the last commit', () => {
    let first = true;
    class Once extends Directive {
      render(v) { return v; }
      update(_p, [v]) {
        if (first) { first = false; return v; }
        return noChange;
      }
    }
    const once = directive(Once);
    const view = (v) => html`<p>${once(v)}</p>`;
    render(view('x'), container);
    render(view('y'), container);
    assert.equal(strip(container.innerHTML), '<p>x</p>');
  });

  test('a directive wrapped in keyed() keeps its instance while the key holds', () => {
    let made = 0;
    class Mark extends Directive { constructor(i) { super(i); made++; } render(v) { return v; } }
    const mark = directive(Mark);
    const view = (v) => html`<p>${keyed(1, mark(v))}</p>`;
    render(view('a'), container);
    render(view('b'), container);
    assert.equal(strip(container.innerHTML), '<p>b</p>');
    assert.equal(made, 1);
  });

  test('AsyncDirective.setValue() commits to a child part and to an attribute piece', async () => {
    const instances = [];
    class Later extends AsyncDirective {
      constructor(i) { super(i); instances.push(this); }
      render(v) { return v; }
    }
    const later = directive(Later);
    render(html`<p class="x ${later('a')} y">${later('first')}</p>`, container);
    assert.equal(strip(container.innerHTML), '<p class="x a y">first</p>');
    instances[1].setValue('second');
    instances[0].setValue('b');
    assert.equal(strip(container.innerHTML), '<p class="x b y">second</p>');
  });

  test('an async directive follows its host component and is released with its part', async () => {
    const log = [];
    class Life extends AsyncDirective {
      render(v) { return v; }
      disconnected() { log.push('disconnected'); }
      reconnected() { log.push('reconnected'); }
    }
    const life = directive(Life);
    class LifeHost extends WebComponent {
      static properties = { show: { type: Boolean } };
      constructor() { super(); this.show = true; }
      render() { return html`<p>${this.show ? life('on') : 'off'}</p>`; }
    }
    LifeHost.register('custom-directive-life-host');
    const el = document.createElement('custom-directive-life-host');
    container.appendChild(el);
    await el.updateComplete;
    assert.equal(strip(el.innerHTML), '<p>on</p>');
    el.remove();
    assert.deepEqual(log, ['disconnected']);
    container.appendChild(el);
    await tick();
    assert.deepEqual(log, ['disconnected', 'reconnected']);
    el.show = false;
    await el.updateComplete;
    assert.equal(strip(el.innerHTML), '<p>off</p>');
    assert.deepEqual(log, ['disconnected', 'reconnected', 'disconnected']);
    // Released: a later host disconnect no longer reaches it.
    el.remove();
    assert.deepEqual(log, ['disconnected', 'reconnected', 'disconnected']);
  });

  test('a directive inside an array item renders through render()', () => {
    const up = directive(class extends Directive { render(v) { return String(v).toUpperCase(); } });
    render(html`<p>${['a', 'b'].map((x) => up(x))}</p>`, container);
    assert.equal(strip(container.innerHTML), '<p>AB</p>');
  });
});
