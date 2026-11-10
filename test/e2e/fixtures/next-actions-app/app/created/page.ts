import { html } from '@webjsdev/core';
import { readRuns } from '#modules/read-runs.server.ts';

export default async function Created() {
  return html`<p id="runs">${await readRuns()}</p>`;
}
