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

/* ------------- prop() with options preserves the type ------------- */

class Toggle extends WebComponent({ pressed: prop(Boolean, { reflect: true }) }) {}
Toggle.register('my-toggle');
const toggle = new Toggle();
type _Pressed = Assert<Equal<typeof toggle.pressed, boolean>>;

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
