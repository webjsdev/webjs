/**
 * The preview-02 "Kitchen Island" light control: an on switch, a scene picker
 * and four sliders. A fragment helper; the switch, the scene picker and the
 * sliders are the kit's `<ui-switch>`, `<ui-toggle-group>` and `<ui-slider>`.
 * Installed at `components/preview-02/kitchen-island.ts`. Ported from
 * shadcn/ui's preview-02.
 *
 * It renders the "Cooking" scene. shadcn moves the four sliders to each
 * scene's preset from React state. Here the presets are in `SCENES`: listen
 * for the toggle group's `ui-value-change` in a small element of your own and
 * set the sliders' values, or post the choice to the server and render it.
 */
import { html } from '@webjsdev/core';
import type { TemplateResult } from '@webjsdev/core';
import { cn } from '../../../lib/utils.ts';
import {
  cardActionClass,
  cardClass,
  cardContentClass,
  cardDescriptionClass,
  cardHeaderClass,
  cardTitleClass,
} from '../../../components/card.ts';
import {
  itemActionsClass,
  itemClass,
  itemContentClass,
  itemGroupClass,
  itemMediaClass,
  itemTitleClass,
} from '../../../components/item.ts';
import { sliderClass } from '../../../components/slider.ts';
import '../../../components/slider.ts';
import '../../../components/switch.ts';
import '../../../components/toggle-group.ts';
import { SunIcon, ThermometerIcon, TimerIcon, Volume2Icon } from '../../../lib/icons.ts';

/** Each scene's slider values, shadcn's presets. */
export const SCENES = {
  cooking: { brightness: 90, colorTemp: 70, volume: 30, fade: 0 },
  dining: { brightness: 50, colorTemp: 40, volume: 20, fade: 60 },
  nightlight: { brightness: 15, colorTemp: 20, volume: 0, fade: 80 },
  focus: { brightness: 100, colorTemp: 85, volume: 0, fade: 0 },
};

function control(icon: TemplateResult, title: string, name: string, value: number) {
  return html`<div data-slot="item" data-variant="outline" data-size="sm" class=${itemClass({ variant: 'outline', size: 'sm' })}>
    <div data-slot="item-media" data-variant="icon" class=${itemMediaClass({ variant: 'icon' })}>${icon}</div>
    <div data-slot="item-content" class=${cn(itemContentClass(), 'flex-row items-center gap-3')}>
      <div data-slot="item-title" class=${cn(itemTitleClass(), 'shrink-0')}>${title}</div>
    </div>
    <div data-slot="item-actions" class=${cn(itemActionsClass(), 'flex-1')}>
      <ui-slider class="w-full">
        <input type="range" name=${name} min="0" max="100" value=${value} aria-label=${title} class=${sliderClass()}>
      </ui-slider>
    </div>
  </div>`;
}

export function kitchenIsland() {
  const scene = SCENES.cooking;
  return html`
    <div data-slot="card" data-size="default" class=${cardClass()}>
      <div data-slot="card-header" class=${cardHeaderClass()}>
        <div data-slot="card-title" class=${cardTitleClass()}>Kitchen Island</div>
        <div data-slot="card-description" class=${cardDescriptionClass()}>Hue Color Ambient</div>
        <div data-slot="card-action" class=${cardActionClass()}>
          <ui-switch name="kitchen_island_on" aria-label="Kitchen Island lights" checked></ui-switch>
        </div>
      </div>
      <div data-slot="card-content" class=${cn(cardContentClass(), 'flex flex-col gap-4')}>
        <div class="flex flex-col gap-2">
          <span class="sr-only" id="kitchen-island-scenes">Scenes</span>
          <ui-toggle-group type="single" value="cooking" variant="outline" spacing="1" aria-labelledby="kitchen-island-scenes" class="flex-wrap">
            <ui-toggle-group-item value="cooking">Cooking</ui-toggle-group-item>
            <ui-toggle-group-item value="dining">Dining</ui-toggle-group-item>
            <ui-toggle-group-item value="nightlight">Nightlight</ui-toggle-group-item>
            <ui-toggle-group-item value="focus">Focus</ui-toggle-group-item>
          </ui-toggle-group>
        </div>
        <div role="list" data-slot="item-group" class=${itemGroupClass()}>
          ${control(SunIcon(), 'Brightness', 'brightness', scene.brightness)}
          ${control(ThermometerIcon(), 'Color Temp', 'color_temp', scene.colorTemp)}
          ${control(Volume2Icon(), 'Volume', 'volume', scene.volume)}
          ${control(TimerIcon(), 'Fade', 'fade', scene.fade)}
        </div>
      </div>
    </div>
  `;
}
