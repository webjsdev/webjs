/**
 * @typedef {import('../codes.js').DoctorResult} DoctorResult
 */

/**
 * Advisory (#1686): a page, layout or boundary runs only on the server, so
 * code in one that looks meant for the browser (a browser global, a
 * client-router or reactive import, a side-effect import that sets something
 * up) silently does nothing there. The hints come from the shared route
 * report. WARN only: each pattern is legal on the server.
 * @param {Promise<any|null>} reportPromise  the ONE shared route report
 * @returns {Promise<DoctorResult>}
 */
export async function checkRouteBrowserCode(reportPromise) {
  const name = 'Route modules (browser code that runs only on the server)';
  const report = await reportPromise;
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
 * Orphan component classes (#1308): a `class X extends WebComponent` with no
 * literal-tag registration, either because there is no registration call or
 * because the tag is computed. The scanner matches only a literal tag
 * (invariant 3), so it never sees the class: no registry entry, no boot
 * import and no preload hint. Pass-only except for an orphan; never `fail`,
 * so an app that wants an orphan to break CI gates `ORPHAN_COMPONENTS` to
 * `error` via `webjs.doctor.gate`.
 * @param {Promise<any|null>} reportPromise  the ONE shared route report
 * @returns {Promise<DoctorResult>}
 */
export async function checkOrphanComponents(reportPromise) {
  const name = 'Components (orphan classes the scanner cannot see)';
  const report = await reportPromise;
  if (!report || !report.analysed) {
    return { name, status: 'pass', message: 'not analysed (no routable app or analysis unavailable)' };
  }
  if (report.orphans.length === 0) {
    return { name, status: 'pass', message: 'every component class is registered with a literal tag' };
  }
  const lines = report.orphans.map(({ file, className }) =>
    `${className} in ${file} is never registered with a literal tag`,
  );
  return {
    name,
    status: 'warn',
    message:
      `${report.orphans.length} component class(es) the scanner cannot see:\n` +
      lines.map((l) => `    ${l}`).join('\n') +
      '\n    Either it has no registration call at all, or it registers a computed tag. The component '
      + 'scanner matches only a literal tag, so either way it never sees the class: no registry entry, '
      + 'no boot import and no preload hint. With no registration call the element never upgrades at all; '
      + 'with a computed tag it upgrades only while a module that ships imports it.',
    fix: 'Register it with a literal tag, Class.register(\'my-tag\') (invariant 3 already requires one), or delete the class if nothing uses it.',
  };
}
