/**
 * Type fixture: the Lit element members and type names WebComponent
 * implements type-check the way a Lit author writes them. Run by
 * `test/types/type-fixtures.test.mjs` via `tsc --noEmit --strict`.
 */
import { WebComponent, html } from '@webjsdev/core';
import type {
  PropertyValues, PropertyValueMap, PropertyDeclarations, ReactiveControllerHost, ComplexAttributeConverter,
} from '@webjsdev/core';

class LitShaped extends WebComponent {
  static shadow = true;
  static shadowRootOptions: ShadowRootInit = { mode: 'open', delegatesFocus: true };
  static properties = { count: { type: Number, reflect: true } };
  declare count: number;

  createRenderRoot() {
    const root = super.createRenderRoot();
    return root;
  }

  async scheduleUpdate() {
    await new Promise((r) => setTimeout(r, 0));
    super.scheduleUpdate();
  }

  firstUpdated() {
    const input: HTMLInputElement | null | undefined = this.renderRoot?.querySelector('input');
    input?.focus();
    const done: boolean = this.hasUpdated && !this.isUpdatePending;
    void done;
    this.performUpdate();
  }

  render() {
    return html`<input .value=${String(this.count)}>`;
  }
}

class LightByOverride extends WebComponent {
  createRenderRoot() { return this; }
}

LitShaped.createProperty('label', { type: String });
const opts = LitShaped.getPropertyOptions('count');
const t: unknown = opts.type;
const names: PropertyKey[] = [...LitShaped.elementProperties.keys()];
LitShaped.addInitializer((el) => el.requestUpdate());
LitShaped.finalize();

class TypedHooks extends WebComponent({ count: Number }) {
  static properties: PropertyDeclarations = { extra: { type: String } };
  willUpdate(changed: PropertyValues<this>) {
    const old: number | undefined = changed.get('count');
    void old;
  }
  updated(changed: PropertyValues) {
    void changed.has('anything');
  }
}

class HostOnlyController {
  host: ReactiveControllerHost;
  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController({ hostConnected: () => host.requestUpdate() });
  }
}
const dateConverter: ComplexAttributeConverter<Date> = {
  fromAttribute: (v) => new Date(v ?? 0),
  toAttribute: (d) => d.toISOString(),
};
const m = new Map() as PropertyValueMap<{ a: number }>;
new HostOnlyController(new TypedHooks());

export { LitShaped, LightByOverride, TypedHooks, t, names, dateConverter, m };
