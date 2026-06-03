/**
 * Type overlay for `@webjsdev/server/check` (the convention validator backing
 * `webjs check`, exported on its own subpath so the CLI can load it without
 * booting the full server).
 *
 * The runtime is packages/server/src/check.js (JSDoc-annotated JavaScript);
 * this overlay exists so a TypeScript consumer's `import { checkConventions }
 * from '@webjsdev/server/check'` resolves precise types instead of emitting
 * TS7016. Zero runtime cost.
 */

/** A single convention violation reported by `checkConventions`. */
export interface Violation {
  /** The rule name that fired (e.g. `no-browser-globals-in-render`). */
  rule: string;
  /** The offending file path. */
  file: string;
  /** What is wrong. */
  message: string;
  /** How to fix it. */
  fix: string;
}

/** A rule's name + human description, for help text / docs. */
export interface RuleDescriptor {
  name: string;
  description: string;
}

/** All available correctness rules with descriptions. */
export declare const RULES: RuleDescriptor[];

/**
 * Run every correctness check against an app directory, returning the list of
 * violations (empty when the app is clean). Correctness-only; report-only, no
 * autofix.
 */
export declare function checkConventions(appDir: string): Promise<Violation[]>;
