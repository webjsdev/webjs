/**
 * Grade one app an agent built: `webjs check` must report nothing, the app
 * must boot, and every probe of the task must hold. Reuses the framework's own
 * pieces (`checkConventions`, `createRequestHandler`), so the grade is what an
 * app would see in production, with no port and no browser.
 */
import { checkConventions } from '@webjsdev/server/check';
import { createRequestHandler } from '@webjsdev/server';

/** @typedef {import('./tasks.mjs').Probe} Probe */
/** @typedef {{ ok: boolean, check: { rule: string, file: string, message: string }[], boot: string | null, probes: { probe: string, ok: boolean, detail: string }[] }} Grade */

/**
 * @param {string} appDir
 * @param {Probe[]} probes
 * @returns {Promise<Grade>}
 */
export async function gradeApp(appDir, probes) {
  /** @type {Grade} */
  const grade = { ok: false, check: [], boot: null, probes: [] };
  try {
    grade.check = (await checkConventions(appDir)).map((v) => ({ rule: v.rule, file: v.file, message: v.message }));
  } catch (err) {
    grade.check = [{ rule: 'check-crashed', file: '', message: String(err?.message || err) }];
  }

  let handler;
  try {
    handler = await createRequestHandler({ appDir, dev: false, logger: quietLogger() });
    if (handler.warmup) await handler.warmup();
  } catch (err) {
    grade.boot = String(err?.message || err).split('\n')[0];
  }

  if (handler) {
    for (const probe of probes) grade.probes.push(await runProbe(handler, probe));
  }
  grade.ok = grade.check.length === 0 && grade.boot === null && grade.probes.length === probes.length && grade.probes.every((p) => p.ok);
  return grade;
}

/** @param {any} handler @param {Probe} probe */
async function runProbe(handler, probe) {
  const label = `${probe.form ? 'POST(form) ' : probe.method ? `${probe.method} ` : ''}${probe.path}${probe.cookie ? ` [${probe.cookie}]` : ''}`;
  const fetchApp = (path, init = {}) => handler.handle(new Request('http://localhost' + path, init));
  try {
    const headers = new Headers();
    if (probe.cookie) headers.set('cookie', probe.cookie);
    let res;
    if (probe.form) {
      const page = await fetchApp(probe.path, { headers });
      const form = firstForm(await page.text());
      if (!form) return { probe: label, ok: false, detail: 'no <form> on the page' };
      const body = new URLSearchParams({ ...form.fields, ...probe.form });
      headers.set('content-type', 'application/x-www-form-urlencoded');
      headers.set('origin', 'http://localhost');
      headers.set('sec-fetch-site', 'same-origin');
      res = await fetchApp(form.action || probe.path, { method: form.method || 'POST', headers, body, redirect: 'manual' });
    } else {
      res = await fetchApp(probe.path, { method: probe.method || 'GET', headers, redirect: 'manual' });
    }
    const wanted = Array.isArray(probe.status) ? probe.status : [probe.status];
    if (!wanted.includes(res.status)) return { probe: label, ok: false, detail: `status ${res.status}, wanted ${wanted.join(' or ')}` };
    if (probe.header) {
      const [name, re] = probe.header;
      const value = res.headers.get(name) || '';
      if (!re.test(value)) return { probe: label, ok: false, detail: `${name}: ${value || '(absent)'} does not match ${re}` };
    }
    const text = probe.contains || probe.images ? await res.text() : '';
    for (const needle of [probe.contains || []].flat()) {
      if (!text.includes(needle)) return { probe: label, ok: false, detail: `body lacks ${JSON.stringify(needle)}` };
    }
    if (probe.images) {
      const srcs = [...text.matchAll(/<img\b[^>]*\bsrc="(\/[^"]*)"/g)].map((m) => m[1]);
      if (srcs.length === 0) return { probe: label, ok: false, detail: 'no same-origin <img src> on the page' };
      for (const src of srcs) {
        const img = await fetchApp(src);
        if (img.status !== 200) return { probe: label, ok: false, detail: `image ${src} answered ${img.status}` };
      }
    }
    return { probe: label, ok: true, detail: `status ${res.status}` };
  } catch (err) {
    return { probe: label, ok: false, detail: `threw: ${String(err?.message || err).split('\n')[0]}` };
  }
}

/**
 * The first form in an HTML page: its action, method, and the values of its
 * named inputs (hidden fields included, which is where a bound server action's
 * identity rides).
 * @param {string} html
 */
export function firstForm(html) {
  const m = /<form\b([^>]*)>([\s\S]*?)<\/form>/i.exec(html);
  if (!m) return null;
  const attr = (src, name) => (new RegExp(`\\b${name}="([^"]*)"`, 'i').exec(src) || [])[1];
  /** @type {Record<string, string>} */
  const fields = {};
  for (const input of m[2].matchAll(/<(?:input|button)\b([^>]*)>/gi)) {
    const name = attr(input[1], 'name');
    if (!name) continue;
    const type = (attr(input[1], 'type') || '').toLowerCase();
    // A submitter contributes its pair only when pressed; the grader presses the
    // first one, which is what a person clicking the only button does.
    if (input[0].toLowerCase().startsWith('<button') || type === 'submit') {
      if (!(name in fields)) fields[name] = attr(input[1], 'value') || '';
      continue;
    }
    fields[name] = attr(input[1], 'value') || '';
  }
  return { action: attr(m[1], 'action'), method: (attr(m[1], 'method') || '').toUpperCase(), fields };
}

function quietLogger() {
  const noop = () => {};
  return { info: noop, warn: noop, error: noop, debug: noop };
}
