/**
 * Floating placement: positions a panel beside the element that opened it.
 * Tier-2 support module. The kit's overlays that measure their own placement
 * (tooltip, hover card, the dropdown, context and menubar menus, select,
 * combobox) import `positionFloating` from here, and so does a hand-built
 * popover that wants measured placement.
 *
 * It is its own module because it reads the window and the elements' boxes,
 * which is browser code. Kept beside the popover's class helpers, it would make
 * every page importing `popoverContentClass` ship to the browser whole, the
 * same reason `cn()` and the DOM helpers are separate modules.
 */
import type { PopoverSide, PopoverAlign } from './popover.ts';

/**
 * Places `content` beside `trigger`, flipping to the opposite side when it
 * does not fit, and keeps it 8px inside the viewport.
 *
 * `radix` names the component the way Radix does (`dropdown-menu`,
 * `tooltip`), and makes this set the variables Radix's positioner sets on the
 * panel, which shadcn's classes read: `--radix-<name>-trigger-width` /
 * `-height`, `--radix-<name>-content-available-width` / `-height` and
 * `--radix-<name>-content-transform-origin`. Without them a class such as
 * `w-(--radix-dropdown-menu-trigger-width)` resolves to nothing, and a fixed
 * panel with no width stretches across the viewport.
 */
export function positionFloating(
  trigger: HTMLElement,
  content: HTMLElement,
  opts: {
    side?: PopoverSide;
    align?: PopoverAlign;
    sideOffset?: number;
    alignOffset?: number;
    radix?: string;
  } = {},
): void {
  const side = opts.side ?? 'bottom';
  const align = opts.align ?? 'center';
  const sideOffset = opts.sideOffset ?? 4;
  const alignOffset = opts.alignOffset ?? 0;
  const tr = trigger.getBoundingClientRect();
  const vars = opts.radix ? `--radix-${opts.radix}` : '';
  // The trigger's size first: a panel sized from it can only be measured
  // once it is set.
  if (vars) {
    content.style.setProperty(`${vars}-trigger-width`, `${tr.width}px`);
    content.style.setProperty(`${vars}-trigger-height`, `${tr.height}px`);
  }
  const cr = content.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;
  let actualSide = side;

  const fitsBottom = tr.bottom + sideOffset + cr.height <= vh;
  const fitsTop = tr.top - sideOffset - cr.height >= 0;
  const fitsRight = tr.right + sideOffset + cr.width <= vw;
  const fitsLeft = tr.left - sideOffset - cr.width >= 0;

  if (side === 'bottom' && !fitsBottom && fitsTop) actualSide = 'top';
  else if (side === 'top' && !fitsTop && fitsBottom) actualSide = 'bottom';
  else if (side === 'right' && !fitsRight && fitsLeft) actualSide = 'left';
  else if (side === 'left' && !fitsLeft && fitsRight) actualSide = 'right';

  if (actualSide === 'bottom') top = tr.bottom + sideOffset;
  else if (actualSide === 'top') top = tr.top - sideOffset - cr.height;
  else if (actualSide === 'right' || actualSide === 'left') {
    if (align === 'start') top = tr.top;
    else if (align === 'end') top = tr.bottom - cr.height;
    else top = tr.top + (tr.height - cr.height) / 2;
  }

  if (actualSide === 'right') left = tr.right + sideOffset;
  else if (actualSide === 'left') left = tr.left - sideOffset - cr.width;
  else {
    if (align === 'start') left = tr.left;
    else if (align === 'end') left = tr.right - cr.width;
    else left = tr.left + (tr.width - cr.width) / 2;
  }

  // alignOffset shifts the popover along the align axis. For align='start',
  // positive shifts AWAY from the start edge; align='end' reverses; center
  // is a no-op. Axis is perpendicular to the chosen side.
  if (align !== 'center' && alignOffset !== 0) {
    const dir = align === 'start' ? 1 : -1;
    if (actualSide === 'top' || actualSide === 'bottom') {
      left += dir * alignOffset;
    } else {
      top += dir * alignOffset;
    }
  }

  left = Math.max(8, Math.min(left, vw - cr.width - 8));
  top = Math.max(8, Math.min(top, vh - cr.height - 8));

  content.style.top = `${top}px`;
  content.style.left = `${left}px`;
  if (vars) {
    // What Radix's size and transform-origin middleware report, with no
    // collision padding and no arrow.
    const availableHeight =
      actualSide === 'bottom' ? vh - tr.bottom - sideOffset
        : actualSide === 'top' ? tr.top - sideOffset
          : vh;
    const availableWidth =
      actualSide === 'right' ? vw - tr.right - sideOffset
        : actualSide === 'left' ? tr.left - sideOffset
          : vw;
    const along = align === 'start' ? '0%' : align === 'end' ? '100%' : '50%';
    const origin =
      actualSide === 'bottom' ? `${along} 0px`
        : actualSide === 'top' ? `${along} 100%`
          : actualSide === 'right' ? `0px ${along}`
            : `100% ${along}`;
    content.style.setProperty(`${vars}-content-available-height`, `${Math.max(0, availableHeight)}px`);
    content.style.setProperty(`${vars}-content-available-width`, `${Math.max(0, availableWidth)}px`);
    content.style.setProperty(`${vars}-content-transform-origin`, origin);
  }
  content.setAttribute('data-side', actualSide);
  content.setAttribute('data-align', align);
}
