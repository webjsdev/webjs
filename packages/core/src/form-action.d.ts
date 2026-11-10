/** Form actions (#1155): `<form action=${importedAction}>` and its wire. */

/** The hidden field carrying a bound action's identity into the submission. */
export const FORM_ACTION_FIELD: '__webjs_action';

/** The property a generated client RPC stub carries its own identity on. */
export const FORM_ACTION_ID_KEY: '$$webjsAction';

/**
 * Server-only wiring: maps a REAL server-action function back to its
 * `<hash>/<fn>` identity. `@webjsdev/server` installs it at boot; the browser
 * bundle drops it, because a stub carries its identity on itself.
 */
export function setFormActionResolver(
  fn: (fn: Function) => string | null | Promise<string | null>,
): void;

/**
 * Give an action (or its browser stub) a `.bind` that keeps its identity, so
 * `<form action=${rsvp.bind(null, slug)}>` submits `rsvp(slug, formData)`.
 * Wired by `@webjsdev/server` and by every generated stub; apps just call `.bind`.
 */
export function installActionBind<F extends Function>(fn: F): F;

/** The identity a form submits for an action bound to `args` (`<hash>/<fn>#<args>`). */
export function bindActionId(id: string, args: unknown[]): string;

/** Split a submitted identity into the action's own identity and its bound arguments. */
export function splitActionId(value: string): { id: string; args: unknown[] };
