/**
 * The preview-02 Roller Shades card: a shade drawn at its position, a slider
 * that moves it, and Open / Half / Closed presets. Installed by
 * `npx @webjsdev/ui add preview-02` at `components/preview-02/roller-shades.ts`.
 * Ported from shadcn/ui's preview-02.
 *
 * The markup is a fragment the server renders at the half-closed position.
 * `<preview-02-roller-shades>` adds the behaviour shadcn keeps in React state:
 * the slider redraws the shade and picks the matching preset, and a preset
 * moves the slider. Wire `ui-value-commit` from the slider to an action that
 * drives the real shade.
 */
import { WebComponent, html } from '@webjsdev/core';
import {
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardFooterClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import { sliderClass } from '../../../components/slider.ts';
import { cn } from '../../../lib/utils.ts';
import '../../../components/slider.ts';
import '../../../components/toggle-group.ts';

const PRESETS: Record<string, number> = { open: 0, half: 50, closed: 100 };

function presetFor(position: number): string {
  return position <= 10 ? 'open' : position >= 90 ? 'closed' : 'half';
}

/** Keeps the shade, the slider and the presets in step. */
export class Preview02RollerShades extends WebComponent {
  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('input', this._onInput);
    this.addEventListener('ui-value-change', this._onPreset);
  }

  disconnectedCallback() {
    this.removeEventListener('input', this._onInput);
    this.removeEventListener('ui-value-change', this._onPreset);
    super.disconnectedCallback();
  }

  _draw(position: number): void {
    const shade = this.querySelector<HTMLElement>('[data-shade]');
    if (shade) shade.style.height = `${position}%`;
  }

  _onInput = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    if (input.type !== 'range') return;
    const position = Number(input.value);
    this._draw(position);
    const group = this.querySelector<HTMLElement & { value: string }>('ui-toggle-group');
    if (group && group.value !== presetFor(position)) group.value = presetFor(position);
  };

  _onPreset = (e: Event): void => {
    const target = e.target as HTMLElement;
    if (target.localName !== 'ui-toggle-group') return;
    const position = PRESETS[(e as CustomEvent<{ value: string }>).detail?.value];
    if (position === undefined) return;
    const input = this.querySelector<HTMLInputElement>('input[type="range"]');
    if (input) {
      input.value = String(position);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };

  render() {
    return html`<slot></slot>`;
  }
}
Preview02RollerShades.register('preview-02-roller-shades');

export function rollerShades(opts: { position?: number } = {}) {
  const position = opts.position ?? 50;
  return html`
    <preview-02-roller-shades>
      <div data-slot="card" data-size="default" class=${cardClass()}>
        <div data-slot="card-header" class=${cardHeaderClass()}>
          <div data-slot="card-title" class=${cardTitleClass()}>Living Room</div>
          <div data-slot="card-description" class=${cardDescriptionClass()}>Roller Shades</div>
        </div>
        <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
          <div class="flex h-32 flex-col overflow-hidden rounded-lg border bg-muted">
            <div data-shade class="bg-muted-foreground transition-all duration-300 motion-reduce:transition-none" style=${`height: ${position}%`}></div>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Open</span>
            <ui-slider class="flex-1">
              <input type="range" min="0" max="100" step="1" value=${String(position)} name="shade-position" aria-label="Shade position" class=${sliderClass()}>
            </ui-slider>
            <span class="text-xs font-medium tracking-wider text-muted-foreground uppercase">Close</span>
          </div>
        </div>
        <div data-slot="card-footer" class=${cardFooterClass()}>
          <ui-toggle-group type="single" value=${presetFor(position)} variant="outline" spacing="1" aria-label="Shade preset" class="w-full">
            <ui-toggle-group-item value="open" class="flex-1">Open</ui-toggle-group-item>
            <ui-toggle-group-item value="half" class="flex-1">Half</ui-toggle-group-item>
            <ui-toggle-group-item value="closed" class="flex-1">Closed</ui-toggle-group-item>
          </ui-toggle-group>
        </div>
      </div>
    </preview-02-roller-shades>
  `;
}
