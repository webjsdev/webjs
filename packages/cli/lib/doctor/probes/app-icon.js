import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLACEHOLDER_MARKER, isLegacyBrandFavicon } from '../../app-icon.js';

/**
 * @typedef {import('../codes.js').DoctorResult} DoctorResult
 */

/** @param {string} file */
function read(file) {
  try { return readFileSync(file, 'utf8'); } catch { return ''; }
}

/**
 * Warn when the app's favicon is still the one `webjs create` shipped: the
 * neutral `app/icon.svg` placeholder, or the WebJs brand mark earlier
 * scaffolds put at `public/favicon.svg`. Either way every app made from the
 * scaffold shows the same tab icon, which reads as a demo rather than a
 * product. An app with no `app/` directory (a library, the api template with
 * no pages) passes.
 *
 * @param {string} appDir
 * @returns {DoctorResult}
 */
export function checkAppIcon(appDir) {
  const name = 'app-icon';
  if (!existsSync(join(appDir, 'app'))) return { name, status: 'pass', message: 'no app/ directory to analyse' };
  const fix = 'Replace app/icon.svg with an icon for this app (a simple symbol for what it is, in its own colours, legible at 16px), and delete public/favicon.svg plus any metadata.icons that still points at it.';
  if (read(join(appDir, 'app', 'icon.svg')).includes(PLACEHOLDER_MARKER)) {
    return { name, status: 'warn', message: 'app/icon.svg is still the scaffold placeholder icon', fix };
  }
  if (isLegacyBrandFavicon(read(join(appDir, 'public', 'favicon.svg')))) {
    return { name, status: 'warn', message: 'public/favicon.svg is still the WebJs mark an earlier scaffold shipped', fix };
  }
  return { name, status: 'pass', message: 'the app has its own icon (or declares none)' };
}
