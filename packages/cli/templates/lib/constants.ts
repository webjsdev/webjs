/**
 * App-wide constants. Browser-safe, importable from anywhere.
 *
 * Lives at lib/ root (not lib/utils/) to demonstrate the convention.
 * Files at the root of lib/ are appropriate for app-level constants,
 * shared types, or thin helpers that don't fit a utils/ grouping.
 *
 * Compare with:
 *   lib/utils/     browser-safe helper FUNCTIONS grouped by concern
 *   lib/server/    server-only infrastructure (prisma, sessions, etc.)
 *
 * Replace SITE_NAME with your real value and add the constants your app
 * needs (max lengths, page sizes, feature flags, …). One file at lib/
 * root per concern is fine; reach for lib/utils/ when you have helper
 * FUNCTIONS to group, not constant VALUES.
 */

/** Display name. Used by metadata, headers, footers. */
export const SITE_NAME = '{{APP_NAME}}';
