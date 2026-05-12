/**
 * The 7 base colours shadcn ships. Each one swaps a small set of oklch hue/chroma
 * values; lightness stays identical so contrast ratios are preserved.
 *
 * The build pipeline emits one `r/themes/<name>.json` per entry.
 */

export const BASE_COLORS = ['neutral', 'stone', 'zinc', 'mauve', 'olive', 'mist', 'taupe'];

/**
 * Per-base overrides on the canonical neutral palette. Anything not listed here
 * is inherited from `themes/index.css` (the neutral default).
 *
 * Numbers chosen to match shadcn's emitted oklch values (apps/v4/public/r/themes/*.json).
 */
export const BASE_OVERRIDES = {
  neutral: { light: {}, dark: {} },
  stone: {
    light: {
      foreground: 'oklch(0.147 0.004 49.25)',
      'card-foreground': 'oklch(0.147 0.004 49.25)',
      'popover-foreground': 'oklch(0.147 0.004 49.25)',
      primary: 'oklch(0.216 0.006 56.043)',
      'primary-foreground': 'oklch(0.985 0.001 106.423)',
      secondary: 'oklch(0.97 0.001 106.424)',
      'secondary-foreground': 'oklch(0.216 0.006 56.043)',
      muted: 'oklch(0.97 0.001 106.424)',
      'muted-foreground': 'oklch(0.553 0.013 58.071)',
      accent: 'oklch(0.97 0.001 106.424)',
      'accent-foreground': 'oklch(0.216 0.006 56.043)',
      border: 'oklch(0.923 0.003 48.717)',
      input: 'oklch(0.923 0.003 48.717)',
      ring: 'oklch(0.709 0.01 56.259)',
    },
    dark: {
      background: 'oklch(0.147 0.004 49.25)',
      card: 'oklch(0.216 0.006 56.043)',
      popover: 'oklch(0.216 0.006 56.043)',
      primary: 'oklch(0.923 0.003 48.717)',
      'primary-foreground': 'oklch(0.216 0.006 56.043)',
      secondary: 'oklch(0.268 0.007 34.298)',
      muted: 'oklch(0.268 0.007 34.298)',
      'muted-foreground': 'oklch(0.709 0.01 56.259)',
      accent: 'oklch(0.371 0.011 67.558)',
      border: 'oklch(1 0 0 / 10%)',
      input: 'oklch(1 0 0 / 15%)',
      ring: 'oklch(0.553 0.013 58.071)',
    },
  },
  zinc: {
    light: {
      foreground: 'oklch(0.141 0.005 285.823)',
      primary: 'oklch(0.21 0.006 285.885)',
      'primary-foreground': 'oklch(0.985 0 0)',
      secondary: 'oklch(0.967 0.001 286.375)',
      'secondary-foreground': 'oklch(0.21 0.006 285.885)',
      muted: 'oklch(0.967 0.001 286.375)',
      'muted-foreground': 'oklch(0.552 0.016 285.938)',
      accent: 'oklch(0.967 0.001 286.375)',
      'accent-foreground': 'oklch(0.21 0.006 285.885)',
      border: 'oklch(0.92 0.004 286.32)',
      input: 'oklch(0.92 0.004 286.32)',
      ring: 'oklch(0.705 0.015 286.067)',
    },
    dark: {
      background: 'oklch(0.141 0.005 285.823)',
      card: 'oklch(0.21 0.006 285.885)',
      popover: 'oklch(0.21 0.006 285.885)',
      primary: 'oklch(0.92 0.004 286.32)',
      'primary-foreground': 'oklch(0.21 0.006 285.885)',
      secondary: 'oklch(0.274 0.006 286.033)',
      muted: 'oklch(0.274 0.006 286.033)',
      'muted-foreground': 'oklch(0.705 0.015 286.067)',
      accent: 'oklch(0.274 0.006 286.033)',
      ring: 'oklch(0.552 0.016 285.938)',
    },
  },
  mauve: {
    light: {
      primary: 'oklch(0.42 0.05 296)',
      'primary-foreground': 'oklch(0.985 0 0)',
      accent: 'oklch(0.96 0.01 296)',
      'accent-foreground': 'oklch(0.42 0.05 296)',
      ring: 'oklch(0.55 0.05 296)',
    },
    dark: {
      primary: 'oklch(0.75 0.06 296)',
      accent: 'oklch(0.35 0.04 296)',
      ring: 'oklch(0.55 0.05 296)',
    },
  },
  olive: {
    light: {
      primary: 'oklch(0.40 0.06 130)',
      'primary-foreground': 'oklch(0.985 0 0)',
      accent: 'oklch(0.95 0.02 130)',
      'accent-foreground': 'oklch(0.40 0.06 130)',
      ring: 'oklch(0.55 0.05 130)',
    },
    dark: {
      primary: 'oklch(0.70 0.07 130)',
      accent: 'oklch(0.35 0.05 130)',
      ring: 'oklch(0.55 0.05 130)',
    },
  },
  mist: {
    light: {
      primary: 'oklch(0.42 0.05 196)',
      'primary-foreground': 'oklch(0.985 0 0)',
      accent: 'oklch(0.95 0.02 196)',
      'accent-foreground': 'oklch(0.42 0.05 196)',
      ring: 'oklch(0.55 0.05 196)',
    },
    dark: {
      primary: 'oklch(0.72 0.06 196)',
      accent: 'oklch(0.35 0.04 196)',
      ring: 'oklch(0.55 0.05 196)',
    },
  },
  taupe: {
    light: {
      primary: 'oklch(0.40 0.04 30)',
      'primary-foreground': 'oklch(0.985 0 0)',
      accent: 'oklch(0.95 0.02 30)',
      'accent-foreground': 'oklch(0.40 0.04 30)',
      ring: 'oklch(0.55 0.05 30)',
    },
    dark: {
      primary: 'oklch(0.72 0.05 30)',
      accent: 'oklch(0.35 0.04 30)',
      ring: 'oklch(0.55 0.05 30)',
    },
  },
};
