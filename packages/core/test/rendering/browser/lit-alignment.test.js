import { nothing, noChange } from '../../../src/sentinels.js';
import { classMap, styleMap, ifDefined } from '../../../src/attribute-directives.js';
import { html } from '../../../src/html.js';
import { render } from '../../../src/render-client.js';
import { WebComponent } from '../../../src/component.js';
import { until } from '../../../src/directives.js';
import { assert } from '../../../../../test/browser-assert.js';

// Behavioral cases from lit-html EventPart, pinned to Lit b17fb14470c69a68205c10b69451883da07f4dde.
suite('Lit JS event compatibility', () => {
  test('function receiver, explicit host, arrows, bound functions and object listeners', () => {
    const container = document.createElement('div');
    let receiver;
    function listener() { receiver = this; }
    const view = (fn) => html`<button @click=${fn}>Go</button>`;
    render(view(listener), container);
    const button = container.querySelector('button');
    button.click(); assert.equal(receiver, button);
    const host = {};
    // Use a fresh container because render options, like Lit, belong to the root.
    const hosted = document.createElement('div');
    render(view(listener), hosted, { host });
    hosted.querySelector('button').click(); assert.equal(receiver, host);
    const bound = {};
    render(view(listener.bind(bound)), hosted, { host });
    hosted.querySelector('button').click(); assert.equal(receiver, bound);
    const object = { handleEvent() { receiver = this; } };
    render(view(object), hosted, { host });
    hosted.querySelector('button').click(); assert.equal(receiver, object);
    render(view(null), hosted, { host });
    receiver = null; hosted.querySelector('button').click(); assert.equal(receiver, null);
  });
  test('once is not rearmed by changing a handler without changing options', () => {
    const container = document.createElement('div'); let clicks = 0;
    const view = (handler) => html`<button @click=${handler}>Go</button>`;
    const a = { once: true, handleEvent() { clicks++; } };
    render(view(a), container); container.querySelector('button').click();
    render(view({ ...a }), container); container.querySelector('button').click();
    assert.equal(clicks, 1);
    render(view(null), container); render(view(a), container);
    container.querySelector('button').click(); assert.equal(clicks, 2);
  });
  test('component host survives nested asynchronous directive rendering', async () => {
    class Owner extends WebComponent({}) {
      onClick() { this.clicked = true; }
      render() { return html`${until(Promise.resolve(html`<button @click=${this.onClick}>Go</button>`), '')}`; }
    }
    Owner.register('lit-event-owner');
    const el = document.createElement('lit-event-owner'); document.body.append(el);
    await el.updateComplete; await new Promise((resolve) => setTimeout(resolve, 0));
    el.querySelector('button').click(); assert.equal(el.clicked, true); el.remove();
  });
});

suite('Lit quoted bindings', () => {
  test('quoted properties, booleans and events match unquoted bindings', () => {
    const container = document.createElement('div'); let calls = 0;
    render(html`<input .value="${'hello'}" ?disabled='${true}' @click="${() => calls++}">`, container);
    const input = container.querySelector('input');
    assert.equal(input.value, 'hello'); assert.equal(input.disabled, true);
    input.dispatchEvent(new Event('click')); assert.equal(calls, 1);
  });
  test('mixed specialized bindings fail clearly', () => {
    const container = document.createElement('div');
    assert.throws(() => render(html`<input .value="prefix ${'x'}">`, container), /exactly one expression/);
  });
});

suite('Lit expression and helper compatibility', () => {
  test('sentinels work in mixed attributes, children, properties and events', () => {
    const container = document.createElement('div');
    const view = (a, b, value) => html`<input title="a ${a} b ${b}" .value=${value}><p>${a}</p>`;
    render(view('one', 'two', 'text'), container);
    render(view(noChange, 'three', noChange), container);
    assert.equal(container.querySelector('input').title, 'a one b three');
    assert.equal(container.querySelector('input').value, 'text');
    render(view(nothing, 'four', nothing), container);
    assert.equal(container.querySelector('input').hasAttribute('title'), false);
    assert.equal(container.querySelector('p').textContent, '');
  });
  test('ordinary booleans stringify and nullish attributes become empty', () => {
    const container = document.createElement('div');
    render(html`<p title=${null} data-flag=${false}>${false}/${true}</p>`, container);
    assert.equal(container.querySelector('p').getAttribute('title'), '');
    assert.equal(container.querySelector('p').getAttribute('data-flag'), 'false');
    assert.equal(container.textContent, 'false/true');
  });
  test('classMap/styleMap preserve static and external tokens while removing obsolete entries', () => {
    const container = document.createElement('div');
    const view = (active) => html`<p class="fixed ${classMap({ active, fixed: false })}" style="color:red;${styleMap({ opacity: active ? 1 : undefined, '--n': active ? '2' : null })}" title=${ifDefined(active ? 'yes' : undefined)}>Hello</p>`;
    render(view(true), container); const p = container.querySelector('p');
    p.classList.add('external');
    assert.equal(p.style.opacity, '1');
    render(view(false), container);
    assert.equal(p.classList.contains('fixed'), true);
    assert.equal(p.classList.contains('external'), true);
    assert.equal(p.classList.contains('active'), false);
    assert.equal(p.style.color, 'red'); assert.equal(p.style.opacity, '');
    assert.equal(p.hasAttribute('title'), false);
  });
});

suite('Lit map validation and static classes', () => {
  test('empty classMap separates adjacent static classes on initial render and updates', () => {
    const container = document.createElement('div');
    const view = (active) => html`<p class="before${classMap({ active })}after"></p>`;
    render(view(false), container);
    const p = container.querySelector('p');
    assert.equal(p.classList.contains('before'), true);
    assert.equal(p.classList.contains('after'), true);
    assert.equal(p.classList.contains('beforeafter'), false);
    render(view(true), container);
    assert.equal(p.classList.contains('active'), true);
    render(view(false), container);
    assert.equal(p.classList.contains('active'), false);
    assert.equal(p.classList.contains('before'), true);
    assert.equal(p.classList.contains('after'), true);
  });
  test('map bindings validate without reading map entries on an invalid target', () => {
    const container = document.createElement('div');
    const entries = { get active() { throw new Error('entries were formatted'); } };
    assert.throws(() => render(html`<p title=${classMap(entries)}></p>`, container), /class\/style attribute/);
    assert.throws(() => render(html`<p .className=${classMap(entries)}></p>`, container), /require an attribute binding/);
    assert.throws(() => render(html`<p class="${classMap(entries)} ${'other'}"></p>`, container), /single expression/);
  });
});
