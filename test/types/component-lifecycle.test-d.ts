/**
 * Compile-time type test for #433: the base-implemented WebComponent lifecycle
 * callbacks (`connectedCallback` / `disconnectedCallback` /
 * `attributeChangedCallback`) are declared NON-optional, so a subclass override
 * can call `super.X()` without a "possibly undefined" error. The scaffold's own
 * `components/theme-toggle.ts` relies on `super.connectedCallback()`.
 *
 * Run by `test/types/type-fixtures.test.mjs` via `tsc --noEmit --strict`. This
 * fixture IS the counterfactual: re-add the `?` to those declarations in
 * `packages/core/src/component.d.ts` and the `super.X()` calls below fail to
 * compile, so the harness goes red.
 */
import { WebComponent } from '@webjsdev/core';

class ThemeToggleLike extends WebComponent {
  connectedCallback(): void {
    super.connectedCallback(); // base implements it; not possibly-undefined
  }
  disconnectedCallback(): void {
    super.disconnectedCallback();
  }
  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    super.attributeChangedCallback(name, oldValue, newValue);
  }
}

export { ThemeToggleLike };
