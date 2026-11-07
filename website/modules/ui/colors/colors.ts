import { PALETTES } from './palette-data.ts';

/**
 * The Tailwind palette in the formats /ui/colors copies, shadcn/ui's
 * apps/v4/lib/colors.ts (#1666): `getColors()` turns the raw palette data
 * into one entry per shade with its class name, CSS variable, rgb / hsl /
 * oklch in Tailwind's space-separated form, and a text colour that reads on
 * it. Pure data work, read by the page at render time.
 */

export interface Color {
  name: string;
  id: string;
  scale: number;
  className: string;
  hex: string;
  rgb: string;
  hsl: string;
  oklch: string;
  var: string;
  foreground: string;
}

export interface ColorPalette {
  name: string;
  colors: Color[];
}

/** The formats a swatch copies, in shadcn's order. */
export const COLOR_FORMATS = ['className', 'hex', 'rgb', 'hsl', 'oklch', 'var'] as const;
export type ColorFormat = (typeof COLOR_FORMATS)[number];

/** shadcn's default, before a reader picks one. */
export const DEFAULT_COLOR_FORMAT: ColorFormat = 'hsl';

/** Each format's value for one shade, as the format menu lists them. */
export function getColorFormat(color: Color): Record<ColorFormat, string> {
  return {
    // shadcn's menu shows a class here, while a swatch copies the bare
    // `<name>-<scale>`; both are kept as shadcn has them.
    className: `bg-${color.name}-100`,
    hex: color.hex,
    rgb: color.rgb,
    hsl: color.hsl,
    oklch: color.oklch,
    var: `--color-${color.name}-${color.scale}`,
  };
}

export function getColors(): ColorPalette[] {
  return Object.entries(PALETTES).map(([name, shades]) => ({
    name,
    colors: shades.map((shade) => {
      const rgb = shade.rgb.replace(/^rgb\((\d+),(\d+),(\d+)\)$/, '$1 $2 $3');
      return {
        name,
        id: `${name}-${shade.scale}`,
        scale: shade.scale,
        className: `${name}-${shade.scale}`,
        hex: shade.hex,
        rgb,
        hsl: shade.hsl.replace(/^hsl\(([\d.]+),([\d.]+%),([\d.]+%)\)$/, '$1 $2 $3'),
        oklch: `oklch(${shade.oklch.replace(/^oklch\(([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\)$/, '$1 $2 $3')})`,
        var: `--color-${name}-${shade.scale}`,
        foreground: foregroundFor(rgb),
      };
    }),
  }));
}

/** Black or white, whichever reads on the colour (WCAG relative luminance). */
function foregroundFor(rgb: string): string {
  const [r, g, b] = rgb.split(' ').map(Number);
  const linear = (n: number) => {
    const base = n / 255;
    return base <= 0.04045 ? base / 12.92 : Math.pow((base + 0.055) / 1.055, 2.4);
  };
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return luminance > 0.179 ? '#000' : '#fff';
}
