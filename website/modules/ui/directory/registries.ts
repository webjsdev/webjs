/**
 * The registry directory (#1666): the registries a WebJs UI install can read
 * from, shadcn's registry/directory.json in the WebJs format. The Directory
 * docs page lists it and /ui/r/registries.json serves it.
 *
 * An entry's `url` is the registry's BASE url, the one `--registry` takes:
 * `npx @webjsdev/ui add <item> --registry <url>` fetches `<url>/<item>.json`.
 * The first-party registry is the CLI's default and ships inside the
 * package, so its entry needs no flag. To list another, add an entry here;
 * its `logo` is a square SVG drawn with `var(--foreground)`, which the page
 * renders as markup.
 */
export interface Registry {
  name: string;
  homepage: string;
  url: string;
  description: string;
  logo: string;
  /** True for the registry the CLI reads by default, with no flag. */
  default?: boolean;
}

export const REGISTRIES: Registry[] = [
  {
    name: '@webjsdev',
    homepage: 'https://webjs.dev/ui',
    url: 'https://webjs.dev/ui/registry',
    description: 'The WebJs UI components: accessible primitives built on native HTML and styled with Tailwind, copied into your app for you to own.',
    logo: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='24 -4 248 196' fill='var(--foreground)'><path d='M 31.097 15.381 L 38.064 80.000 L 222.044 80.000 L 261.233 15.381 L 233.781 4.619 L 188.064 80.000 L 157.007 80.000 L 141.344 34.718 L 103.100 80.000 L 72.044 80.000 L 63.916 4.619 Z'/><path d='M 39.250 91.000 L 49.642 187.390 L 125.745 97.282 L 156.915 187.390 L 215.372 91.000 L 181.393 91.000 L 168.287 112.610 L 160.812 91.000 L 93.810 91.000 L 75.559 112.610 L 73.230 91.000 Z'/></svg>",
    default: true,
  },
];

/** The command that installs an item from a registry. */
export function addArgs(registry: Registry, item = '<component>'): string {
  return registry.default ? `add ${item}` : `add ${item} --registry ${registry.url}`;
}

/** The registries whose name or description matches `query`, case-insensitively. */
export function searchRegistries(query: string): Registry[] {
  const q = query.trim().toLowerCase();
  if (!q) return REGISTRIES;
  return REGISTRIES.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
}
