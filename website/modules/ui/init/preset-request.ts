import {
  decodePreset,
  isPresetCode,
  resolvePresetConfig,
  type PresetConfig,
} from '../../../../packages/ui/packages/registry/themes/preset.js';

/** The query parameters a design-system choice can ride, shadcn's names. */
const FIELDS = [
  'style',
  'baseColor',
  'theme',
  'chartColor',
  'iconLibrary',
  'font',
  'fontHeading',
  'radius',
  'menuAccent',
  'menuColor',
] as const;

/**
 * Read a design-system choice from a request's query string, the way
 * shadcn's /init does (apps/v4/app/(app)/(create)/lib/parse-config.ts): a
 * `preset` code when there is one, with any field given as its own parameter
 * overriding the code's, else the fields one by one, each missing one taking
 * the preset default. Returns the validated config, or the first reason it
 * is not one.
 */
export function parsePresetRequest(params: URLSearchParams): { config: PresetConfig } | { error: string } {
  const raw = params.get('preset');
  let base: Partial<PresetConfig> = {};
  if (raw) {
    const decoded = isPresetCode(raw) ? decodePreset(raw) : null;
    if (!decoded) return { error: `Invalid preset code "${raw}"` };
    base = decoded;
  }
  const overrides: Partial<Record<(typeof FIELDS)[number], string>> = {};
  for (const field of FIELDS) {
    const value = params.get(field);
    if (value) overrides[field] = value;
  }
  const resolved = resolvePresetConfig({ ...base, ...overrides });
  return resolved.error !== undefined ? { error: resolved.error } : { config: resolved.config };
}
