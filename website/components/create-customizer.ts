import { WebComponent, html } from '@webjsdev/core';
import {
  DEFAULT_ITEM,
  FIELDS,
  createHref,
  initCommand,
  normalizeConfig,
  optionLabel,
  parseCreateParams,
  presetCode,
  previewHref,
  shuffleConfig,
  themeNamesFor,
  type CreateConfig,
  type CreateField,
  type CreateParams,
} from '#modules/ui/create/params.ts';
import { designSystemClass, designSystemVars, fontFamily, styleSheetHref, themeSwatch } from '#modules/ui/create/design-system.ts';

/**
 * `<create-customizer>`, the behaviour of the /ui/create configurator
 * (#1666).
 *
 * It wraps the whole designer, and every piece of markup inside it is the
 * server's (modules/ui/create/): the customizer form and the preview frame
 * with its switch. With JavaScript off that markup is a GET form, popovers
 * and links, and works. This element adds what shadcn's React state does in
 * apps/v4/app/(app)/(create)/, and renders nothing of its own:
 *
 * - A choice applies at once. The theme and chart lists follow the base
 *   color, the trigger labels and swatches update, the preset code and the
 *   init command follow, the URL is rewritten with history.replaceState (the
 *   code IS the state, as shadcn's query string is), and the preview frame's
 *   design-system wrapper is repainted in place (it is same-origin), so a
 *   choice never reloads the frame.
 * - A preview switch click swaps the frame with no page load.
 * - The copy buttons, and a submit inside the frame is cancelled, since a
 *   preview block's form carries no action.
 */
export class CreateCustomizer extends WebComponent {
  private _params: CreateParams = { config: normalizeConfig({}), item: DEFAULT_ITEM };
  private _copyTimers = new Map<Element, ReturnType<typeof setTimeout>>();

  connectedCallback() {
    super.connectedCallback();
    this._params = parseCreateParams(new URLSearchParams(location.search));
    this.addEventListener('change', this._onChange);
    this.addEventListener('click', this._onClick);
    // load does not bubble, so it is caught on the way down.
    this.addEventListener('load', this._onFrameLoad, true);
    this.addEventListener('slotchange', this._enhance);
    this._enhance();
  }

  disconnectedCallback() {
    this.removeEventListener('change', this._onChange);
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('load', this._onFrameLoad, true);
    this.removeEventListener('slotchange', this._enhance);
    for (const timer of this._copyTimers.values()) clearTimeout(timer);
    super.disconnectedCallback();
  }

  /** The state the configurator shows now. */
  get params(): CreateParams {
    return this._params;
  }

  /** Apply a config (and optionally a preview item), as a choice would. */
  apply(config: Partial<CreateConfig>, item: string = this._params.item): void {
    this._params = { config: normalizeConfig({ ...this._params.config, ...config }), item };
    history.replaceState(history.state, '', createHref(this._params));
    this._sync();
  }

  private _enhance = (): void => {
    this._sync();
    const frame = this._frame();
    if (frame?.contentDocument?.readyState === 'complete') this._onFrameLoad();
  };

  private _frame(): HTMLIFrameElement | null {
    return this.querySelector('[data-slot="create-preview"] iframe');
  }

  // ---- events --------------------------------------------------------------

  private _onChange = (e: Event): void => {
    const radio = e.target as HTMLInputElement;
    if (radio.type !== 'radio' || !(FIELDS as readonly string[]).includes(radio.name)) return;
    const field = radio.name as CreateField;
    const next: Partial<CreateConfig> = { [field]: radio.value };
    // A new base color takes its own palette, as shadcn's picker does when
    // the theme was the old base color.
    if (field === 'baseColor' && !themeNamesFor(radio.value).includes(this._params.config.theme)) {
      next.theme = radio.value;
    }
    this.apply(next);
  };

  private _onClick = (e: MouseEvent): void => {
    const target = e.target as Element;
    const copy = target.closest<HTMLButtonElement>('button[data-action^="copy-"]');
    if (copy) {
      void this._copy(copy);
      return;
    }
    const link = target.closest<HTMLAnchorElement>('a[data-item]');
    if (link && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      this.apply({}, link.dataset.item || DEFAULT_ITEM);
      const frame = this._frame();
      if (frame) frame.src = previewHref(this._params);
    }
  };

  private _onFrameLoad = (e?: Event): void => {
    const frame = this._frame();
    if (e && e.target !== frame) return;
    const doc = frame?.contentDocument;
    if (!doc) return;
    // The frame loaded with the code in its src. A change made while it
    // loaded is in this._params, so bring it level.
    this._paintFrame();
    doc.addEventListener('submit', (ev) => ev.preventDefault(), true);
  };

  private async _copy(button: HTMLButtonElement): Promise<void> {
    const text = button.dataset.action === 'copy-preset' ? presetCode(this._params.config) : initCommand(this._params.config);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    button.setAttribute('data-copied', '');
    clearTimeout(this._copyTimers.get(button));
    this._copyTimers.set(button, setTimeout(() => button.removeAttribute('data-copied'), 2000));
  }

  // ---- keeping the markup in step -----------------------------------------

  private _sync(): void {
    const { config } = this._params;
    const wearable = themeNamesFor(config.baseColor);
    for (const radio of this.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      const field = radio.name as CreateField;
      if (!(FIELDS as readonly string[]).includes(field)) continue;
      if (field === 'theme' || field === 'chartColor') {
        const ok = wearable.includes(radio.value);
        radio.disabled = !ok;
        const label = radio.closest('label');
        if (label) label.hidden = !ok;
      }
      radio.checked = config[field] === radio.value;
    }
    for (const field of FIELDS) {
      const root = this.querySelector(`[data-picker="${field}"]`);
      if (!root) continue;
      const current = root.querySelector('[data-current]');
      if (current) current.textContent = optionLabel(field, config[field], config);
      const swatch = root.querySelector<HTMLElement>('[data-swatch]');
      if (swatch) swatch.style.setProperty('--color', themeSwatch(config[field]));
      const sample = root.querySelector<HTMLElement>('[data-sample]');
      if (sample) sample.style.fontFamily = fontFamily(field === 'fontHeading' && config.fontHeading === 'inherit' ? config.font : config[field]);
    }
    const code = presetCode(config);
    for (const el of this.querySelectorAll('[data-preset-code]')) el.textContent = code;
    for (const el of this.querySelectorAll('[data-init-command]')) el.textContent = initCommand(config);
    for (const a of this.querySelectorAll<HTMLAnchorElement>('a[data-init-md]')) a.href = `/ui/init/md?preset=${code}`;
    for (const a of this.querySelectorAll<HTMLAnchorElement>('a[data-action="shuffle"]')) {
      a.href = createHref({ config: shuffleConfig(config), item: this._params.item });
    }
    for (const a of this.querySelectorAll<HTMLAnchorElement>('a[data-item]')) {
      const item = a.dataset.item || DEFAULT_ITEM;
      const active = item === this._params.item;
      a.href = createHref({ ...this._params, item });
      a.dataset.active = String(active);
      if (active) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    for (const a of this.querySelectorAll<HTMLAnchorElement>('a[data-open-preview]')) a.href = previewHref(this._params);
    const itemInput = this.querySelector<HTMLInputElement>('input[type="hidden"][name="item"]');
    if (itemInput) itemInput.value = this._params.item;
    this._paintFrame();
  }

  /** Repaint the preview frame's design-system wrapper with the current choice. */
  private _paintFrame(): void {
    const doc = this._frame()?.contentDocument;
    const root = doc?.querySelector<HTMLElement>('[data-slot="design-system"]');
    if (!doc || !root) return;
    const { config } = this._params;
    root.className = designSystemClass(config);
    for (const [name, value] of Object.entries(designSystemVars(config))) root.style.setProperty(name, value);
    const sheet = styleSheetHref(config.style);
    if (sheet && !doc.querySelector(`link[data-style-sheet="${config.style}"]`)) {
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = sheet;
      link.dataset.styleSheet = config.style;
      (doc.head || doc.body).append(link);
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
CreateCustomizer.register('create-customizer');
