/**
 * Shared harness for the Next.js action-parity e2e tests: stage the
 * `next-actions-app` fixture with the framework linked in, start `webjs dev`
 * on a free port, and launch Chromium.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const FIXTURE = resolve(__dirname, 'fixtures', 'next-actions-app');

function freePort() {
  return new Promise((res, rej) => {
    const srv = createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
    srv.on('error', rej);
  });
}

function stageApp() {
  const dir = mkdtempSync(join(tmpdir(), 'webjs-next-actions-e2e-'));
  cpSync(FIXTURE, dir, { recursive: true });
  mkdirSync(join(dir, 'node_modules/@webjsdev'), { recursive: true });
  for (const pkg of ['core', 'server']) {
    symlinkSync(join(ROOT, 'packages', pkg), join(dir, 'node_modules/@webjsdev', pkg));
  }
  return dir;
}

function startDev(dir, port) {
  const cli = resolve(ROOT, 'packages', 'cli', 'bin', 'webjs.js');
  return new Promise((res, rej) => {
    const child = spawn(process.execPath, [cli, 'dev', '--port', String(port)], {
      cwd: dir,
      env: { ...process.env, __WEBJS_DEV_CHILD: '1', NODE_ENV: 'development' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let started = false;
    let log = '';
    const onData = (chunk) => {
      log += chunk.toString();
      if (!started && log.includes('ready on')) { started = true; res(child); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', rej);
    child.on('exit', (code) => {
      if (!started) rej(new Error(`dev server exited with ${code} before ready\n${log}`));
    });
    setTimeout(() => { if (!started) rej(new Error(`dev server start timeout\n${log}`)); }, 20000);
  });
}

/** @returns {Promise<{ base: string, browser: any, stop: () => Promise<void> }>} */
export async function startFixtureDev() {
  const puppeteer = (await import('puppeteer-core')).default;
  const dir = stageApp();
  const port = await freePort();
  const child = await startDev(dir, port);
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return {
    base: `http://localhost:${port}`,
    browser,
    async stop() {
      await browser.close();
      try { child.kill('SIGTERM'); } catch { /* gone */ }
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
