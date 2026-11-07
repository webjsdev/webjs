import { WebComponent, html } from '@webjsdev/core';
import { THEME_STORAGE_KEY, type Theme } from '#lib/theme.ts';
import {
  DEFAULT_CONFIG,
  DEFAULT_ITEM,
  FIELDS,
  ITEM_NAME,
  createHref,
  initCommand,
  isTranslucentMenuColor,
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
import {
  designSystemClass,
  designSystemData,
  designSystemVars,
  syncDesignSystemText,
  fontFamily,
  styleSheetHref,
  themeSwatch,
  themeTokensCss,
} from '#modules/ui/create/design-system.ts';
import {
  DEFAULT_PROJECT,
  PACKAGE_MANAGERS,
  applyCommand,
  newProjectCommand,
  projectName,
  type Database,
  type PackageManager,
  type ProjectOptions,
  type Runtime,
} from '#modules/ui/create/project.ts';
import { WELCOME_STORAGE_KEY } from '#modules/ui/create/welcome-dialog.ts';

type ThemeToggleElement = HTMLElement & { theme?: { set(value: Theme): void } };

// How long the pointer must settle on an item before the preview shows it,
// shadcn's PREVIEW_OVERRIDE_DEBOUNCE_MS.
const PREVIEW_DELAY = 50;

/**
 * `<create-customizer>`, the behaviour of the /ui/create configurator
 * (#1666).
 *
 * It wraps the whole designer, and every piece of markup inside it is the
 * server's (modules/ui/create/): the customizer form, the preview frame with
 * its switch and item explorer, the Get Code dialog and the welcome dialog.
 * With JavaScript off that markup is a GET form, popovers, links and dialogs
 * an invoker command opens, and works. This element adds what shadcn's React
 * state does in apps/v4/app/(app)/(create)/, and renders nothing of its own:
 *
 * - A choice applies at once: the theme lists follow the base color, the
 *   labels and swatches update, the preset code and every command follow,
 *   the URL is rewritten with history.replaceState (the code IS the state, as
 *   shadcn's query string is), and the preview frame's design-system wrapper
 *   is repainted in place (it is same-origin), so a choice never reloads it.
 * - Hover preview: resting the pointer on an item shows it in the frame,
 *   uncommitted, and leaving the list puts the committed choice back
 *   (shadcn's preview override).
 * - History: undo and redo over the committed codes, Cmd or Ctrl+Z and
 *   Shift+Cmd or Ctrl+Z (Ctrl+Y too), shadcn's HistoryProvider. Its own stack,
 *   since replaceState leaves the browser's history alone.
 * - Shuffle (R) from shadcn's curated presets, keeping every locked field;
 *   Reset (Shift+R); Light/Dark (D). Also from inside the frame.
 * - The item explorer: Cmd or Ctrl+P opens it, typing filters it, and a pick
 *   swaps the frame with no page load, as a preview switch click does.
 * - The welcome dialog on the first visit, the Get Code dialog's commands,
 *   the copy buttons, and a submit inside the frame is cancelled, since a
 *   preview block's form carries no action.
 */
export class CreateCustomizer extends WebComponent {
  private _params: CreateParams = { config: normalizeConfig({}), item: DEFAULT_ITEM };
  private _past: string[] = [];
  private _future: string[] = [];
  private _locks = new Set<CreateField>();
  private _project: ProjectOptions = { ...DEFAULT_PROJECT };
  private _previewTimer: ReturnType<typeof setTimeout> | undefined;
  private _copyTimers = new Map<Element, ReturnType<typeof setTimeout>>();
  private _frameDoc: Document | null = null;
  private _welcomeTimer: ReturnType<typeof setTimeout> | undefined;

  connectedCallback() {
    super.connectedCallback();
    this._params = parseCreateParams(new URLSearchParams(location.search));
    this.addEventListener('change', this._onChange);
    this.addEventListener('input', this._onInput);
    this.addEventListener('click', this._onClick);
    this.addEventListener('pointerover', this._onPointerOver);
    this.addEventListener('keydown', this._onMenuKey);
    // toggle, pointerleave, load and close do not bubble, so these listen in
    // the capture phase, which sees them on the way down.
    this.addEventListener('toggle', this._onToggle, true);
    this.addEventListener('pointerleave', this._onPointerLeave, true);
    this.addEventListener('load', this._onFrameLoad, true);
    this.addEventListener('close', this._onDialogClose, true);
    this.addEventListener('slotchange', this._enhance);
    document.addEventListener('keydown', this._onKey);
    this._enhance();
    // After the markup is projected into the slot (a microtask after
    // connecting): moving a modal dialog takes it out of the top layer.
    this._welcomeTimer = setTimeout(() => this._maybeWelcome(), 0);
  }

  disconnectedCallback() {
    this.removeEventListener('change', this._onChange);
    this.removeEventListener('input', this._onInput);
    this.removeEventListener('click', this._onClick);
    this.removeEventListener('pointerover', this._onPointerOver);
    this.removeEventListener('keydown', this._onMenuKey);
    this.removeEventListener('toggle', this._onToggle, true);
    this.removeEventListener('pointerleave', this._onPointerLeave, true);
    this.removeEventListener('load', this._onFrameLoad, true);
    this.removeEventListener('close', this._onDialogClose, true);
    this.removeEventListener('slotchange', this._enhance);
    document.removeEventListener('keydown', this._onKey);
    this._detachFrame();
    clearTimeout(this._previewTimer);
    clearTimeout(this._welcomeTimer);
    for (const timer of this._copyTimers.values()) clearTimeout(timer);
    super.disconnectedCallback();
  }

  /** The state the configurator shows now. */
  get params(): CreateParams {
    return this._params;
  }

  /** The fields Shuffle keeps. */
  get locks(): ReadonlySet<CreateField> {
    return this._locks;
  }

  get canUndo(): boolean {
    return this._past.length > 0;
  }

  get canRedo(): boolean {
    return this._future.length > 0;
  }

  /**
   * Commit a choice (and optionally a preview item), as a pick would: the URL,
   * the frame, the controls. A change of code is a history step unless
   * `record` is false (undo and redo themselves).
   */
  apply(config: Partial<CreateConfig>, item: string = this._params.item, { record = true } = {}): void {
    const before = presetCode(this._params.config);
    this._params = { config: normalizeConfig({ ...this._params.config, ...config }), item };
    const after = presetCode(this._params.config);
    if (record && after !== before) {
      this._past.push(before);
      this._future = [];
    }
    history.replaceState(history.state, '', createHref(this._params));
    clearTimeout(this._previewTimer);
    this._sync();
  }

  undo(): void {
    const code = this._past.pop();
    if (code === undefined) return;
    this._future.push(presetCode(this._params.config));
    this.apply(parseCreateParams(new URLSearchParams({ preset: code })).config, this._params.item, { record: false });
  }

  redo(): void {
    const code = this._future.pop();
    if (code === undefined) return;
    this._past.push(presetCode(this._params.config));
    this.apply(parseCreateParams(new URLSearchParams({ preset: code })).config, this._params.item, { record: false });
  }

  /** shadcn's randomize: a curated preset, the locked fields kept. */
  shuffle(): void {
    this.apply(shuffleConfig(this._params.config, this._locks, Math.random));
  }

  reset(): void {
    this.apply({ ...DEFAULT_CONFIG });
  }

  toggleLock(field: CreateField): void {
    if (this._locks.has(field)) this._locks.delete(field);
    else this._locks.add(field);
    this._syncLocks();
  }

  toggleTheme(): void {
    const root = document.documentElement;
    const current = root.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
    root.dataset.theme = next;
    document.querySelector<ThemeToggleElement>('theme-toggle')?.theme?.set(next);
    if (this._frameDoc) this._frameDoc.documentElement.dataset.theme = next;
  }

  /** Show an item in the frame: a preview block, a block, or a component demo. */
  showItem(item: string): void {
    if (!ITEM_NAME.test(item)) return;
    this.apply({}, item, { record: false });
    const frame = this._frame();
    if (frame) frame.src = previewHref(this._params);
    this._closePopups();
  }

  openExplorer(): void {
    const explorer = this.querySelector<HTMLElement>('[data-explorer]');
    if (!explorer) return;
    if (!explorer.matches(':popover-open')) explorer.showPopover();
    explorer.querySelector<HTMLInputElement>('[data-explorer-filter]')?.focus();
  }

  private _enhance = (): void => {
    for (const el of this.querySelectorAll<HTMLButtonElement>('button[data-action]')) el.disabled = false;
    if (/Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent)) {
      this._setShortcut('navigate', '⌘P');
      this._setShortcut('undo', '⌘Z');
      this._setShortcut('redo', '⇧⌘Z');
    }
    this._sync();
    this._syncLocks();
    this._syncProject();
    const frame = this._frame();
    if (!this._frameDoc && frame?.contentDocument?.readyState === 'complete') this._onFrameLoad();
  };

  private _setShortcut(action: string, label: string): void {
    const el = this.querySelector(`[data-shortcut="${action}"]`);
    if (el) el.textContent = label;
  }

  private _frame(): HTMLIFrameElement | null {
    return this.querySelector('[data-slot="create-preview"] iframe');
  }

  // ---- events --------------------------------------------------------------

  private _onChange = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    if (input.dataset.projectField) {
      this._readProject();
      return;
    }
    if (input.type !== 'radio' || !(FIELDS as readonly string[]).includes(input.name)) return;
    const field = input.name as CreateField;
    const next: Partial<CreateConfig> = { [field]: input.value };
    // A new base color takes its own palette, as shadcn's picker does when
    // the theme was the old base color.
    if (field === 'baseColor' && !themeNamesFor(input.value).includes(this._params.config.theme)) {
      next.theme = input.value;
    }
    this.apply(next);
  };

  private _onInput = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    if (input.matches('[data-explorer-filter]')) this._filterExplorer(input.value);
    else if (input.dataset.projectField === 'name') this._readProject();
  };

  private _onClick = (e: MouseEvent): void => {
    const target = e.target as Element;
    const lock = target.closest<HTMLButtonElement>('button[data-lock]');
    if (lock) {
      e.preventDefault();
      this.toggleLock(lock.dataset.lock as CreateField);
      return;
    }
    const copy = target.closest<HTMLButtonElement>('button[data-action^="copy-"]');
    if (copy) {
      void this._copy(copy);
      return;
    }
    const plain = e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
    const action = target.closest<HTMLElement>('[data-action]');
    if (action && plain) {
      const run: Record<string, () => void> = {
        shuffle: () => this.shuffle(),
        reset: () => this.reset(),
        undo: () => this.undo(),
        redo: () => this.redo(),
        theme: () => this.toggleTheme(),
        navigate: () => { this._closePopups(); this.openExplorer(); },
        'get-code': () => this._openDialog('create-project'),
      };
      const fn = run[action.dataset.action || ''];
      if (fn) {
        e.preventDefault();
        if (action.closest('#create-menu')) this._closePopups();
        fn();
        return;
      }
    }
    const link = target.closest<HTMLAnchorElement>('a[data-item]');
    if (link && plain) {
      e.preventDefault();
      this.showItem(link.dataset.item || DEFAULT_ITEM);
    }
  };

  /** The shortcuts, shadcn's: R, Shift+R, D, Cmd or Ctrl+Z (Shift for redo, Ctrl+Y too), Cmd or Ctrl+P. */
  private _onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    // shadcn skips every input; its pickers are not inputs, while these are
    // radios, so only a field that takes text keeps its keys.
    const typing = !!t && (t.isContentEditable || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement ||
      (t instanceof HTMLInputElement && t.type !== 'radio' && t.type !== 'checkbox'));
    if (typing || e.altKey || this.querySelector('dialog[open]')) return;
    const key = e.key.toLowerCase();
    if (e.metaKey || e.ctrlKey) {
      if (key === 'p') {
        e.preventDefault();
        this.openExplorer();
        return;
      }
      const redo = (key === 'z' && e.shiftKey) || (key === 'y' && e.ctrlKey);
      if (!redo && key !== 'z') return;
      e.preventDefault();
      if (redo) this.redo();
      else this.undo();
      return;
    }
    if (key === 'r') {
      e.preventDefault();
      if (e.shiftKey) this.reset();
      else this.shuffle();
    } else if (key === 'd') {
      e.preventDefault();
      this.toggleTheme();
    }
  };

  /** Arrow keys walk a menu's items, as a menu's do. */
  private _onMenuKey = (e: KeyboardEvent): void => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const menu = (e.target as Element).closest('[role="menu"]');
    if (!menu) return;
    const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')];
    const at = items.indexOf(e.target as HTMLElement);
    const next = items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
    e.preventDefault();
    next?.focus();
  };

  // ---- hover preview -------------------------------------------------------

  /** shadcn's preview override: show the hovered item in the frame, uncommitted. */
  private _onPointerOver = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    const radio = (e.target as Element).closest('label')?.querySelector<HTMLInputElement>('input[type="radio"]');
    if (!radio || radio.disabled || !radio.closest('[popover]') || !(FIELDS as readonly string[]).includes(radio.name)) return;
    const field = radio.name as CreateField;
    const override: Partial<CreateConfig> = { [field]: radio.value };
    if (field === 'baseColor' && !themeNamesFor(radio.value).includes(this._params.config.theme)) override.theme = radio.value;
    clearTimeout(this._previewTimer);
    this._previewTimer = setTimeout(
      () => this._paintFrame(normalizeConfig({ ...this._params.config, ...override })),
      PREVIEW_DELAY,
    );
  };

  private _onPointerLeave = (e: Event): void => {
    if ((e.target as Element).matches?.('[popover][data-picker-content]')) this._endPreview();
  };

  private _endPreview(): void {
    clearTimeout(this._previewTimer);
    this._paintFrame(this._params.config);
  }

  // ---- popovers and dialogs ------------------------------------------------

  private _popups(): HTMLElement[] {
    return [...this.querySelectorAll<HTMLElement>('[popover]')];
  }

  private _closePopups(): void {
    for (const popup of this._popups()) {
      if (popup.matches(':popover-open')) popup.hidePopover();
    }
  }

  private _onToggle = (e: Event): void => {
    const popup = e.target as HTMLElement;
    if (!popup.matches?.('[popover]')) return;
    const trigger = this.querySelector<HTMLElement>(`[popovertarget="${popup.id}"]`);
    const open = (e as ToggleEvent).newState === 'open';
    if (trigger) trigger.setAttribute('aria-expanded', String(open));
    if (!open) {
      this._endPreview();
      return;
    }
    if (trigger && popup.matches('[data-picker-content]')) this._place(popup, trigger);
    if (popup.matches('[data-picker-content]')) {
      popup.querySelector<HTMLElement>('input[type="radio"]:checked, [role="menuitem"]:not([disabled])')?.focus({ preventScroll: true });
    }
  };

  /** shadcn's Positioner: beside the trigger from md up, above the card on a phone. */
  private _place(popup: HTMLElement, trigger: HTMLElement): void {
    const style = popup.style;
    style.margin = '0';
    style.inset = 'auto';
    const r = trigger.getBoundingClientRect();
    if (matchMedia('(min-width: 768px)').matches) {
      const alignOffset = Number(popup.dataset.alignOffset ?? 0);
      const top = Math.max(8, Math.min(r.top + alignOffset + 8, innerHeight - popup.offsetHeight - 8));
      style.left = `${r.right + 20}px`;
      style.top = `${top}px`;
    } else {
      const card = trigger.closest<HTMLElement>('[data-slot="card"]')?.getBoundingClientRect() ?? r;
      style.left = '12px';
      style.top = `${Math.max(8, card.top - 12 - popup.offsetHeight)}px`;
    }
  }

  private _openDialog(id: string): void {
    const dialog = this.querySelector<HTMLDialogElement>(`dialog#${id}`);
    if (!dialog || dialog.matches(':modal')) return;
    // A dialog left open but not modal (moved after it opened) is closed
    // first, so it can open as a modal. Its close event arrives after it is
    // open again, which the close handler reads as no close at all.
    if (dialog.open) dialog.close();
    dialog.showModal();
  }

  /** shadcn's WelcomeDialog: once, on the first visit. */
  private _maybeWelcome(): void {
    let seen = true;
    try { seen = !!localStorage.getItem(WELCOME_STORAGE_KEY); } catch {}
    if (!seen) this._openDialog('create-welcome');
  }

  private _onDialogClose = (e: Event): void => {
    const dialog = e.target as HTMLDialogElement;
    if (dialog.open) return;
    if (dialog.id === 'create-welcome') {
      try { localStorage.setItem(WELCOME_STORAGE_KEY, 'true'); } catch {}
    }
  };

  private _filterExplorer(query: string): void {
    const q = query.trim().toLowerCase();
    for (const group of this.querySelectorAll<HTMLElement>('[data-explorer-group]')) {
      let shown = 0;
      for (const item of group.querySelectorAll<HTMLElement>('[data-explorer-item]')) {
        const match = !q || (item.dataset.explorerItem || '').includes(q) || (item.dataset.item || '').includes(q);
        item.hidden = !match;
        if (match) shown++;
      }
      group.hidden = shown === 0;
    }
  }

  // ---- the frame -----------------------------------------------------------

  private _onFrameLoad = (e?: Event): void => {
    const frame = this._frame();
    if (e && e.target !== frame) return;
    this._detachFrame();
    const doc = frame?.contentDocument;
    if (!doc) return;
    this._frameDoc = doc;
    // The frame loaded with the code in its src. A change made while it
    // loaded is in this._params, so bring it level.
    this._paintFrame(this._params.config);
    doc.addEventListener('submit', this._cancel, true);
    // The shortcuts work with focus inside the frame too (shadcn forwards
    // them by postMessage; this frame is same-origin).
    doc.addEventListener('keydown', this._onKey);
  };

  private _cancel = (e: Event): void => e.preventDefault();

  private _detachFrame(): void {
    this._frameDoc?.removeEventListener('submit', this._cancel, true);
    this._frameDoc?.removeEventListener('keydown', this._onKey);
    this._frameDoc = null;
  }

  /** Paint the preview frame's design-system wrapper with a config. */
  private _paintFrame(config: CreateConfig): void {
    const doc = this._frame()?.contentDocument;
    const root = doc?.querySelector<HTMLElement>('[data-slot="design-system"]');
    if (!doc || !root) return;
    root.className = designSystemClass(config);
    Object.assign(root.dataset, designSystemData(config));
    syncDesignSystemText(root, config);
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
      // shadcn's menu picker drops Bold for a translucent menu.
      if (field === 'menuAccent' && radio.value === 'bold') radio.disabled = isTranslucentMenuColor(config.menuColor);
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
      if (a.closest('nav')) {
        if (active) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      }
    }
    for (const a of this.querySelectorAll<HTMLAnchorElement>('a[data-open-preview]')) a.href = previewHref(this._params);
    const itemInput = this.querySelector<HTMLInputElement>('input[type="hidden"][name="item"]');
    if (itemInput) itemInput.value = this._params.item;
    for (const b of this.querySelectorAll<HTMLButtonElement>('button[data-action="undo"]')) b.disabled = !this.canUndo;
    for (const b of this.querySelectorAll<HTMLButtonElement>('button[data-action="redo"]')) b.disabled = !this.canRedo;
    this._syncProject();
    this._paintFrame(config);
  }

  private _syncLocks(): void {
    for (const button of this.querySelectorAll<HTMLButtonElement>('button[data-lock]')) {
      const locked = this._locks.has(button.dataset.lock as CreateField);
      button.setAttribute('aria-pressed', String(locked));
      button.title = locked ? 'Unlock' : 'Lock';
    }
  }

  // ---- the Get Code dialog -------------------------------------------------

  private _readProject(): void {
    const value = (selector: string) => this.querySelector<HTMLInputElement>(selector)?.value;
    this._project = {
      pm: (value('input[name="new-pm"]:checked') as PackageManager) || this._project.pm,
      runtime: (value('input[name="project-runtime"]:checked') as Runtime) || this._project.runtime,
      db: (value('input[name="project-db"]:checked') as Database) || this._project.db,
      name: projectName(value('[data-project-field="name"]')),
    };
    this._syncProject();
  }

  private _syncProject(): void {
    const code = presetCode(this._params.config);
    for (const pm of PACKAGE_MANAGERS) {
      const create = this.querySelector(`[data-pm="${pm}"] [data-command="new"]`);
      if (create) create.textContent = newProjectCommand({ ...this._project, pm }, code);
      const apply = this.querySelector(`[data-pm="${pm}"] [data-command="existing"]`);
      if (apply) apply.textContent = applyCommand(pm, code);
    }
    const css = this.querySelector('[data-theme-css]');
    if (css) css.textContent = themeTokensCss(this._params.config);
  }

  private async _copy(button: HTMLButtonElement): Promise<void> {
    const action = button.dataset.action;
    let text: string;
    if (action === 'copy-preset') text = presetCode(this._params.config);
    else if (action === 'copy-command') text = initCommand(this._params.config);
    else if (action === 'copy-theme') text = themeTokensCss(this._params.config);
    else {
      const group = action === 'copy-new' ? 'new' : 'existing';
      const pm = this.querySelector<HTMLInputElement>(`input[name="${group}-pm"]:checked`)?.value as PackageManager | undefined;
      const code = presetCode(this._params.config);
      text = group === 'new' ? newProjectCommand({ ...this._project, pm: pm || 'npm' }, code) : applyCommand(pm || 'npm', code);
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    button.setAttribute('data-copied', '');
    clearTimeout(this._copyTimers.get(button));
    this._copyTimers.set(button, setTimeout(() => button.removeAttribute('data-copied'), 2000));
  }

  render() {
    return html`<slot></slot>`;
  }
}
CreateCustomizer.register('create-customizer');
