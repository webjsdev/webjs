/**
 * Startup env-var validation with a typed schema hook (issue #236).
 *
 * webjs auto-loads `<appDir>/.env` into `process.env` at boot, but does no
 * validation, so a missing or misconfigured required var (DATABASE_URL,
 * AUTH_SECRET, ...) fails late and cryptically (a Prisma connect error
 * mid-request, an undefined secret signing a token). This module adds an
 * optional boot-time validation hook that fails fast with one clear message
 * listing EVERY missing or invalid var at once, before the app serves a
 * request.
 *
 * The hook is an optional `env.{js,ts}` module at the app root (sibling of
 * `middleware.js` / `readiness.js`), default-exporting either:
 *   1. a plain SCHEMA object, dependency-free, e.g.
 *        export default {
 *          DATABASE_URL: 'string',
 *          AUTH_SECRET: { type: 'string', required: true, minLength: 16 },
 *          PORT: { type: 'number', optional: true, default: 3000 },
 *          NODE_ENV: { type: 'enum', values: ['development','production','test'] },
 *        };
 *   2. a FUNCTION `(env) => void | throw` for full custom validation (the
 *      escape hatch), so an app can use zod or anything it likes without webjs
 *      depending on it. A thrown Error is surfaced as the boot failure.
 *
 * The validator is a PURE function (`validateEnv`) so it unit-tests with an
 * injected schema + env object, no temp app dir needed. `loadEnvSchema` reads
 * the app's `env.{js,ts}` (returns `null` when absent, so the feature is fully
 * opt-in), and `applyEnvValidation` is the side-effecting boot wrapper: it runs
 * the schema/function against `process.env`, applies coerced + defaulted values
 * back into `process.env`, and throws a clear aggregated Error on failure (so
 * `createRequestHandler` rejects and the CLI exits non-zero, consistent with
 * the Node-version preflight).
 */
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { stat } from 'node:fs/promises';

/** Field type names a schema may declare. */
const KNOWN_TYPES = new Set(['string', 'number', 'boolean', 'url', 'enum']);

/**
 * Normalize a schema field to its object form. A bare string like `'string'`
 * is shorthand for `{ type: 'string' }`.
 * @param {string | object} rule
 * @returns {{ type: string, required?: boolean, optional?: boolean, default?: any, values?: any[], minLength?: number, pattern?: (string|RegExp) }}
 */
function normalizeRule(rule) {
  if (typeof rule === 'string') return { type: rule };
  return rule && typeof rule === 'object' ? rule : { type: 'string' };
}

/**
 * Is a field required? A field is required by default. It is optional when it
 * declares `optional: true`, `required: false`, or carries a `default`.
 * @param {object} rule normalized rule
 */
function isRequired(rule) {
  if (rule.required === false) return false;
  if (rule.optional === true) return false;
  if ('default' in rule) return false;
  return true;
}

/**
 * Coerce a raw string value to the declared type, enforcing the field's
 * constraints. Returns `{ value }` on success or `{ error }` (a human string)
 * on failure.
 * @param {string} name the env var name (for messages)
 * @param {object} rule normalized rule
 * @param {string} raw the raw string from the env
 * @returns {{ value: any } | { error: string }}
 */
function coerce(name, rule, raw) {
  const type = rule.type || 'string';
  switch (type) {
    case 'string': {
      if (typeof rule.minLength === 'number' && raw.length < rule.minLength) {
        return { error: `${name} must be at least ${rule.minLength} characters (got ${raw.length})` };
      }
      if (rule.pattern != null) {
        const re = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern);
        if (!re.test(raw)) return { error: `${name} does not match required pattern ${re}` };
      }
      return { value: raw };
    }
    case 'number': {
      const n = Number(raw);
      if (raw.trim() === '' || Number.isNaN(n)) {
        // Never echo the value: a secret given the wrong type would leak to logs.
        return { error: `${name} must be a number` };
      }
      return { value: n };
    }
    case 'boolean': {
      const v = raw.trim().toLowerCase();
      if (['1', 'true', 'yes', 'on'].includes(v)) return { value: true };
      if (['0', 'false', 'no', 'off'].includes(v)) return { value: false };
      // Never echo the value: list the accepted spellings, not what was given.
      return { error: `${name} must be a boolean (one of true/false/1/0/yes/no/on/off)` };
    }
    case 'url': {
      try {
        // eslint-disable-next-line no-new
        new URL(raw);
        return { value: raw };
      } catch {
        // Never echo the value: a DSN with embedded credentials must not leak.
        return { error: `${name} must be a valid URL` };
      }
    }
    case 'enum': {
      const values = Array.isArray(rule.values) ? rule.values : [];
      if (!values.includes(raw)) {
        // Name the ALLOWED values (from the schema, safe), never the provided one.
        return { error: `${name} must be one of ${values.map((v) => JSON.stringify(v)).join(', ')}` };
      }
      return { value: raw };
    }
    default:
      return { error: `${name} has an unknown schema type ${JSON.stringify(type)}` };
  }
}

/**
 * Pure env validator. Validates `env` against `schema`, collecting ALL errors
 * (never stopping at the first), and computes the coerced + defaulted values to
 * write back. Does NOT mutate `env` or `process.env`; the caller applies
 * `coerced` to `process.env`.
 *
 * When `schema` is a FUNCTION it is the custom-validator escape hatch: it is
 * called with the env object and any thrown Error is surfaced as a single
 * error. A function validator never coerces.
 *
 * @param {object | Function} schema the default export of `env.{js,ts}`
 * @param {Record<string, string|undefined>} env the source env (e.g. process.env)
 * @returns {{ ok: boolean, errors: string[], coerced: Record<string, string> }}
 */
export function validateEnv(schema, env) {
  // Escape hatch: a function gets the env and validates however it wants.
  if (typeof schema === 'function') {
    try {
      schema(env);
      return { ok: true, errors: [], coerced: {} };
    } catch (e) {
      const msg = e && e.message ? String(e.message) : String(e);
      return { ok: false, errors: [msg], coerced: {} };
    }
  }

  if (!schema || typeof schema !== 'object') {
    // Nothing to validate against. Treat as a no-op rather than an error so a
    // stray default export does not brick boot.
    return { ok: true, errors: [], coerced: {} };
  }

  const errors = [];
  /** @type {Record<string, string>} */
  const coerced = {};

  for (const name of Object.keys(schema)) {
    const rule = normalizeRule(schema[name]);
    const type = rule.type || 'string';
    if (!KNOWN_TYPES.has(type)) {
      errors.push(`${name} declares an unknown type ${JSON.stringify(type)} (expected one of ${[...KNOWN_TYPES].join(', ')})`);
      continue;
    }
    const present = env[name] != null && env[name] !== '';
    if (!present) {
      if (isRequired(rule)) {
        errors.push(`${name} is required but missing`);
      } else if ('default' in rule) {
        // Apply the default, coercing it through the same path so a number
        // default lands as a string in process.env (env values are strings).
        coerced[name] = String(rule.default);
      }
      continue;
    }
    const result = coerce(name, rule, String(env[name]));
    if ('error' in result) {
      errors.push(result.error);
    } else if (typeof result.value !== 'string') {
      // Re-stringify coerced non-string values so process.env stays string-typed.
      coerced[name] = String(result.value);
    }
  }

  return { ok: errors.length === 0, errors, coerced };
}

/**
 * Compose the aggregated, actionable failure message from a list of errors.
 * @param {string[]} errors
 * @returns {string}
 */
export function formatEnvErrors(errors) {
  const lines = errors.map((e) => `  - ${e}`);
  return (
    `webjs env validation failed (${errors.length} ${errors.length === 1 ? 'error' : 'errors'}):\n` +
    lines.join('\n') +
    `\n\nFix the variables above in your .env (or the host environment) and restart. ` +
    `The schema lives in env.{js,ts} at the app root.`
  );
}

/**
 * Load the optional `env.{js,ts}` schema module from the app root. Returns the
 * default export (a schema object or a validator function), or `null` when no
 * such file exists, so env validation is fully opt-in.
 * @param {string} appDir
 * @param {{ dev?: boolean }} [opts]
 * @returns {Promise<object | Function | null>}
 */
export async function loadEnvSchema(appDir, opts = {}) {
  let file = null;
  for (const name of ['env.ts', 'env.js', 'env.mts', 'env.mjs']) {
    const p = join(appDir, name);
    try {
      await stat(p);
      file = p;
      break;
    } catch {
      // not this name, try the next
    }
  }
  if (!file) return null;
  const url = pathToFileURL(file).toString();
  const bust = opts.dev ? `?t=${Date.now()}-${Math.random().toString(36).slice(2)}` : '';
  const mod = await import(url + bust);
  return mod.default ?? null;
}

/**
 * Side-effecting boot wrapper: load the app's `env.{js,ts}` (if any), validate
 * `process.env` against it, apply coerced + defaulted values back into
 * `process.env`, and THROW a clear aggregated Error on failure. A no-op when
 * `env.{js,ts}` is absent. Called by `createRequestHandler` right after the
 * `.env` auto-load and before any server-only module is imported.
 * @param {string} appDir
 * @param {{ dev?: boolean, env?: Record<string, string|undefined> }} [opts]
 * @returns {Promise<void>}
 */
export async function applyEnvValidation(appDir, opts = {}) {
  const schema = await loadEnvSchema(appDir, opts);
  if (schema == null) return; // opt-in: no env.{js,ts}, nothing to do
  const env = opts.env ?? process.env;
  const { ok, errors, coerced } = validateEnv(schema, env);
  if (!ok) throw new Error(formatEnvErrors(errors));
  // Apply coerced values + defaults back so the app reads the coerced value.
  for (const key of Object.keys(coerced)) env[key] = coerced[key];
}
