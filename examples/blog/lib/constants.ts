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
 */

/**
 * Maximum length of a comment body. Enforced on the server in
 * modules/comments/actions/create-comment.server.ts and reflected
 * in the browser via `<input maxlength=${COMMENT_MAX_LENGTH}>` so
 * the user can't even type past the limit.
 */
export const COMMENT_MAX_LENGTH = 2000;
