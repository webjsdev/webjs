/**
 * The /ui examples shadcn shows as a picture below md (#1666), with the pixel
 * size of shadcn's own picture of each (public/examples/<name>-light.png in
 * shadcn's site), which ours match. lib/ui/examples-shell.ts renders them and
 * scripts/shoot-example-images.mjs takes them; the RTL example has none.
 */
export const EXAMPLE_IMAGES: Record<string, [width: number, height: number]> = {
  dashboard: [2668, 2824],
  tasks: [2668, 3044],
  playground: [2668, 1730],
  authentication: [2668, 2000],
};
