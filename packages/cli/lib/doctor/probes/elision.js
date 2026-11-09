/**
 * @typedef {import('../codes.js').DoctorResult} DoctorResult
 */

/**
 * Advisory (#1686): a page, layout or boundary runs only on the server, so
 * code in one that looks meant for the browser (a browser global, a
 * client-router or reactive import, a side-effect import that sets something
 * up) silently does nothing there. The hints come from the shared report's
 * route rows. WARN only: each pattern is legal on the server.
 * @param {Promise<any|null>} elisionPromise  the ONE shared report (#1308)
 * @returns {Promise<DoctorResult>}
 */
export async function checkRouteBrowserCode(elisionPromise) {
  const name = 'Route modules (browser code that runs only on the server)';
  const report = await elisionPromise;
  if (!report || !report.analysed) {
    return { name, status: 'pass', message: 'not analysed (no routable app or analysis unavailable)' };
  }
  const hinted = report.routeModules.filter((r) => r.hints && r.hints.length);
  if (hinted.length === 0) {
    return { name, status: 'pass', message: 'no route module holds code meant for the browser' };
  }
  const lines = hinted.flatMap((r) => r.hints.map((h) => `${r.file}: ${h}`));
  return {
    name,
    status: 'warn',
    message:
      `${hinted.length} route module(s) hold code that looks meant for the browser, but pages, layouts and boundaries run only on the server:\n` +
      lines.map((l) => `    ${l}`).join('\n'),
    fix: 'Move browser code into a component (or `instrumentation-client.ts` for app-wide code). See https://webjs.dev/docs/elision.',
  };
}

/**
 * The OTHER direction of the elision verdict (#1308): which COMPONENT modules
 * the browser never downloads, which is where a wrong verdict silently costs an
 * app its interactivity.
 *
 * Pass-only except for orphans, deliberately. An elided component is the
 * DESIRED outcome, so warning on one would fire on every healthy app and train
 * the reader to skip doctor output. The passing message carries the elided
 * inventory instead, which makes it the discovery surface, while `webjs
 * elision` is the detail surface. The one always-wrong condition is an ORPHAN:
 * a `class X extends WebComponent` with no literal-tag registration is
 * invisible to the scanner, so it gets no verdict at all and `static
 * interactive = true` cannot rescue it (nothing consults the component
 * analyser for a component the scanner never saw). Never `fail`:
 * an app that wants an orphan to break CI gates `ELISION_COMPONENTS` to
 * `error` via `webjs.doctor.gate`.
 *
 * @param {Promise<any|null>} elisionPromise  the ONE shared report
 * @returns {Promise<DoctorResult>}
 */
export async function checkElisionComponents(elisionPromise) {
  const name = 'Component elision (what the browser drops)';
  const report = await elisionPromise;
  const notAnalysed = { name, status: /** @type {const} */ ('pass'), message: 'not analysed (no routable app or analysis unavailable)' };
  if (!report) return notAnalysed;
  if (!report.analysed) {
    return notAnalysed;
  }
  if (!report.elide) {
    return { name, status: 'pass', message: 'elision is disabled (`webjs.elide` false or WEBJS_ELIDE), so every component module ships' };
  }
  if (report.orphans.length > 0) {
    const lines = report.orphans.map(({ file, className }) =>
      `${className} in ${file} is never registered with a literal tag`,
    );
    return {
      name,
      status: 'warn',
      message:
        `${report.orphans.length} component class(es) get NO elision verdict:\n` +
        lines.map((l) => `    ${l}`).join('\n') +
        '\n    Either it has no registration call at all, or it registers a computed tag. The component '
        + 'scanner matches only a literal tag, so either way it never sees the class: no elision verdict, no '
        + 'registry entry, no preload hint, and `static interactive = true` cannot rescue it. With no '
        + 'registration call the element never upgrades at all; with a computed tag it upgrades only while '
        + 'its module still reaches the browser through an importer that ships.',
      fix: 'Register it with a literal tag, Class.register(\'my-tag\') (invariant 3 already requires one), or delete the class if nothing uses it.',
    };
  }
  const elided = report.components.filter((c) => c.verdict === 'elided');
  const tags = elided.flatMap((c) => c.tags);
  const shown = tags.slice(0, 8).join(', ');
  const tail = tags.length > 8 ? `, +${tags.length - 8} more` : '';
  return {
    name,
    status: 'pass',
    message:
      `${report.summary.elided} of ${report.summary.components} component module(s) are elided (never downloaded)` +
      (tags.length ? `: ${shown}${tail}` : '') +
      '. Run `webjs elision` for the full verdict.',
  };
}
