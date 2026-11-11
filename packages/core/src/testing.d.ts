import type { TemplateResult } from './html.js';

/**
 * Server-render a template (or an HTML string) into a container in the test
 * page, wait two macrotasks for the element to upgrade, and resolve its first
 * element. A quick mount; use `ssrFixture` when the hydration round trip matters.
 *
 * @example
 * ```js
 * // modules/todos/components/browser/todo-item.test.js, run with `webjs test --browser`
 * import { html } from '@webjsdev/core';
 * import { fixture } from '@webjsdev/core/testing';
 * import '../todo-item.ts';
 *
 * suite('<todo-item>', () => {   // the runner's UI is tdd (suite / test), and a test throws to fail
 *   test('renders its title', async () => {
 *     const el = await fixture(html`<todo-item title="Buy milk"></todo-item>`);
 *     if (!el.textContent?.includes('Buy milk')) throw new Error('the title is missing');
 *   });
 * });
 * ```
 */
export function fixture(template: TemplateResult | string): Promise<Element>;
/**
 * Server-render a template, hydrate it in the real browser, and resolve once
 * the element's `updateComplete` settles, so the post-hydration DOM is what the
 * test reads. The component module must be imported first.
 *
 * @example
 * ```js
 * // modules/counter/components/browser/counter-card.test.js, run with `webjs test --browser`
 * import { html } from '@webjsdev/core';
 * import { ssrFixture, waitForUpdate } from '@webjsdev/core/testing';
 * import '../counter-card.ts';
 *
 * suite('<counter-card>', () => {
 *   test('counts a click after hydration', async () => {
 *     const el = await ssrFixture(html`<counter-card></counter-card>`);
 *     el.querySelector('button')?.click();
 *     await waitForUpdate(el);
 *     if (!el.textContent?.includes('1')) throw new Error('the count did not advance');
 *   });
 * });
 * ```
 */
export function ssrFixture(template: TemplateResult | string): Promise<Element>;
export function waitForUpdate(el: Element): Promise<void>;
export function assertNoA11yViolations(el: Element, opts?: Record<string, unknown>): Promise<void>;
export function click(el: Element): void;
export function shadowQuery(el: Element, selector: string): Element | null;
export function shadowQueryAll(el: Element, selector: string): Element[];
