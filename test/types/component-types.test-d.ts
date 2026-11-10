/**
 * Compile-time type tests for webjs WebComponent intelligence.
 *
 * This file is NOT executed by `node:test`. It is consumed by tsserver in
 * your editor and by any TypeScript project that adds this workspace to
 * its `paths`. If the WebComponent typing regresses, the errors surface
 * as red squiggles here.
 *
 * To verify manually:
 *   npx -p typescript@5.6 tsc --noEmit --target esnext --moduleResolution bundler \
 *     test/types/component-types.test-d.ts
 */

import {
  WebComponent,
  prop,
  html,
  type PropertyDeclaration,
  type PropertyConstructor,
  type ReactiveController,
} from '@webjsdev/core';

/* ------------- Helper: compile-time assertion ------------- */

type Assert<T extends true> = T;
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

/* ------------- The factory infers field types (no `declare`) ------------- */

class Student {
  id = '';
  name = '';
}

// `prop<Student>(Object)` narrows the inferred field type to Student.
class StudentCard extends WebComponent({ student: prop<Student>(Object) }) {
  render() {
    // this.student is a real Student: method access, property access, all typed.
    const _s: string = this.student.name;
    return html`<p>${this.student.name}</p>`;
  }
}
StudentCard.register('student-card');

const card = new StudentCard();
type _Student = Assert<Equal<typeof card.student, Student>>;

/* ------------- Bare-constructor shorthand infers primitives ------------- */

class Counter extends WebComponent({ count: Number, label: String, open: Boolean }) {
  bump() {
    // Typed via the factory's InferProps mapping.
    this.requestUpdate();
    return html`<p>${this.label}: ${this.count}</p>`;
  }
}
Counter.register('my-counter');

const counter = new Counter();
type _Count = Assert<Equal<typeof counter.count, number>>;
type _Label = Assert<Equal<typeof counter.label, string>>;
type _Open = Assert<Equal<typeof counter.open, boolean>>;

/* ------------- Lit's static properties spelling type-checks (#1686) -------------
 * Lit's decorator-free form: a `static properties` map plus an erasable
 * `declare` per prop. The bare-constructor value and a `static get` work too. */
class LitStyle extends WebComponent {
  static properties = {
    count: { type: Number, reflect: true },
    label: { type: String, attribute: 'aria-label' },
    items: { type: Array, default: () => [] as string[] },
  };
  declare count: number;
  declare label: string;
  declare items: string[];
}
const litStyle = new LitStyle();
type _LitCount = Assert<Equal<typeof litStyle.count, number>>;
class BareValue extends WebComponent {
  static properties = { count: Number };
  declare count: number;
}
class GetterForm extends WebComponent {
  static get properties() { return { open: { type: Boolean } }; }
  declare open: boolean;
}
void BareValue; void GetterForm;

/* ------------- The factory-produced base carries the FULL static surface -------------
 * Regression net for the de-duplicated `WebComponentStatics` (#602): both the
 * constructor type and the factory-call return type reference the one shared
 * declaration, so dropping any static from it must red this block. */
const _shadow: boolean = Counter.shadow;
const _hydrate: 'visible' | undefined = Counter.hydrate;
const _properties: Record<string, PropertyDeclaration | PropertyConstructor> = Counter.properties;
const _styles = Counter.styles;
const _lazy: boolean | undefined = Counter.lazy;
const _observed: readonly string[] = Counter.observedAttributes;
Counter.register('my-counter-instance');
void _shadow; void _hydrate; void _properties; void _styles; void _lazy; void _observed;
// `lazy` must stay OPTIONAL (`lazy?`), not merely `boolean | undefined`: an
// empty object is assignable only when the key is optional, so this reds if the
// modifier is ever dropped from the shared declaration.
type _LazyStaysOptional = Assert<{} extends Pick<typeof Counter, 'lazy'> ? true : false>;

/* ------------- prop() with options preserves the type ------------- */

class Toggle extends WebComponent({ pressed: prop(Boolean, { reflect: true }) }) {}
Toggle.register('my-toggle');
const toggle = new Toggle();
type _Pressed = Assert<Equal<typeof toggle.pressed, boolean>>;

/* ------------- state / attribute: false props with no type constructor ------------- */

// Nothing says what an untyped state prop holds, so it is `unknown` (never the
// attribute default `string`) until narrowed with a type argument.
class Panel extends WebComponent({
  open: prop<boolean>({ state: true }),
  rows: prop<string[]>({ attribute: false }),
  loose: prop({ state: true }),
  label: prop({ reflect: true }),
}) {}
Panel.register('my-panel');
const panel = new Panel();
// With no default nothing fills them until the component does, so they are
// `T | undefined`, Lit's `@state() open?: boolean` (#1686).
type _PanelOpen = Assert<Equal<typeof panel.open, boolean | undefined>>;
type _PanelRows = Assert<Equal<typeof panel.rows, string[] | undefined>>;
type _PanelLoose = Assert<Equal<typeof panel.loose, unknown>>;
type _PanelLabel = Assert<Equal<typeof panel.label, string>>;
// A default makes it a plain `T` from the start.
class PanelDefaults extends WebComponent({ open: prop<boolean>({ state: true, default: false }) }) {}
PanelDefaults.register('my-panel-defaults');
type _PanelDefaultOpen = Assert<Equal<InstanceType<typeof PanelDefaults>['open'], boolean>>;
panel.open = true;

/* ------------- PropertyDeclaration shape accepts the expected fields ------------- */

const decl: PropertyDeclaration = {
  type: Number,
  reflect: true,
  state: false,
  attribute: 'data-count',
  hasChanged: (a, b) => a !== b,
  converter: {
    fromAttribute: (v) => Number(v),
    toAttribute: (v) => String(v),
  },
};
void decl; // silence "unused" for the fixture

/* ------------- ReactiveController shape ------------- */

const ctrl: ReactiveController = {
  hostConnected() {},
  hostDisconnected() {},
  hostUpdate() {},
  hostUpdated() {},
};
void ctrl;

/* ------------- Optional: HTMLElementTagNameMap augmentation ------------- */
// Standard TypeScript pattern (same one Lit uses). Enables typed
// document.querySelector / createElement. Opt-in per component.

declare global {
  interface HTMLElementTagNameMap {
    'student-card': StudentCard;
  }
}

const el = document.querySelector('student-card');
type _ElType = Assert<Equal<typeof el, StudentCard | null>>;

export {};
