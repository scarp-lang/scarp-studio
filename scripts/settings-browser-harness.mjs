import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { access, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function eventually(check, description, timeout = 12000) {
  const deadline = Date.now() + timeout;
  let lastError;
  do {
    try { const value = await check(); if (value) return value; }
    catch (error) { lastError = error; }
    await delay(100);
  } while (Date.now() < deadline);
  throw new Error('Timed out: ' + description + (lastError ? ' (' + lastError.message + ')' : ''));
}

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};
export function resolveAsset(dist, url) {
  const pathname = decodeURIComponent(new URL(url, 'http://127.0.0.1').pathname);
  if (pathname.includes('\\') || pathname.includes('\0')) return null;
  const target = resolve(dist, '.' + (pathname === '/' ? '/index.html' : pathname));
  return target.startsWith(dist + sep) ? target : null;
}
export async function serveBuild(dist = join(root, 'dist')) {
  await access(join(dist, 'index.html'));
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405).end(); return;
      }
      const file = resolveAsset(dist, req.url ?? '/');
      if (!file || !(await stat(file)).isFile()) { res.writeHead(404).end(); return; }
      const bytes = await readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'Content-Length': bytes.length,
      });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', ok);
  });
  return { url: 'http://127.0.0.1:' + server.address().port,
    close: () => new Promise(ok => { server.close(ok); server.closeAllConnections(); }) };
}

async function browserExecutable() {
  if (process.env.SCARP_BROWSER_EXECUTABLE) {
    await access(process.env.SCARP_BROWSER_EXECUTABLE);
    return process.env.SCARP_BROWSER_EXECUTABLE;
  }
  const candidates = process.platform === 'win32'
    ? [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
      .filter(Boolean).flatMap(base => [
        join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      ])
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
      : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch { /* try next installed browser */ }
  }
  throw new Error('No Chromium browser found. Set SCARP_BROWSER_EXECUTABLE to an installed browser.');
}

export class DevTools {
  #socket;
  #pending = new Map();
  #next = 0;
  errors = [];
  constructor(socket) {
    this.#socket = socket;
    socket.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id) {
        const pending = this.#pending.get(msg.id);
        if (!pending) return;
        this.#pending.delete(msg.id);
        clearTimeout(pending.timer);
        if (msg.error) pending.reject(new Error(msg.error.message));
        else pending.resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.errors.push(msg.params.exceptionDetails.exception?.description ??
          msg.params.exceptionDetails.text ?? 'Uncaught page exception');
      }
    });
    socket.addEventListener('close', () => {
      for (const pending of this.#pending.values()) {
        clearTimeout(pending.timer); pending.reject(new Error('DevTools disconnected'));
      }
      this.#pending.clear();
    });
  }
  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((ok, fail) => {
      const timer = setTimeout(() => { socket.close(); fail(new Error('DevTools connection timeout')); }, 10000);
      socket.addEventListener('open', () => { clearTimeout(timer); ok(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); fail(new Error('DevTools connection failed')); }, { once: true });
    });
    return new DevTools(socket);
  }
  send(method, params = {}) {
    const id = ++this.#next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id); reject(new Error('DevTools command timed out: ' + method));
      }, 15000);
      this.#pending.set(id, { resolve, reject, timer });
      try { this.#socket.send(JSON.stringify({ id, method, params })); }
      catch (error) { clearTimeout(timer); this.#pending.delete(id); reject(error); }
    });
  }
  async evaluate(fn, ...args) {
    const expression = '(' + fn.toString() + ')(...' + JSON.stringify(args) + ')';
    const result = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  close() { this.#socket.close(); }
}

async function launchBrowserAttempt(url, exe) {
  const profile = await mkdtemp(join(tmpdir(), 'scarp-settings-browser-'));
  const child = spawn(exe, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-extensions', '--disable-sync',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
    '--user-data-dir=' + profile, '--window-size=1440,1000', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  let stderr = '';
  let startupError;
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-5000); });
  child.on('error', error => { startupError = error; });
  let cdp;
  let closing;
  async function closeOnce() {
    if (cdp) { try { await cdp.send('Browser.close'); } catch { /* expected disconnect */ } cdp.close(); }
    if (child.pid && child.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 10000 });
      else child.kill();
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 6, retryDelay: 150 });
  }
  function close() { return closing ??= closeOnce(); }
  try {
    const port = await eventually(async () => {
      if (startupError) throw startupError;
      if (child.exitCode !== null) throw new Error('Browser exited: ' + stderr);
      const file = await readFile(join(profile, 'DevToolsActivePort'), 'utf8');
      const value = Number(file.split(/\r?\n/)[0]);
      return Number.isInteger(value) && value > 0 && value <= 65535 ? value : false;
    }, 'browser debugging port', 20000);
    const page = await eventually(async () => {
      if (startupError) throw startupError;
      if (child.exitCode !== null) throw new Error('Browser exited: ' + stderr);
      const response = await fetch('http://127.0.0.1:' + port + '/json/list', { signal: AbortSignal.timeout(2500) });
      if (!response.ok) throw new Error('DevTools page list HTTP ' + response.status);
      const pages = await response.json();
      if (!Array.isArray(pages)) throw new Error('Unexpected DevTools page list');
      return pages.find(item => item.type === 'page' && typeof item.webSocketDebuggerUrl === 'string' &&
        item.webSocketDebuggerUrl.startsWith('ws://127.0.0.1:' + port + '/')) || false;
    }, 'browser page target', 25000);
    cdp = await DevTools.connect(page.webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    // Check the transport against about:blank BEFORE loading application code.
    // A failure here is infrastructure; application assertions are not retried.
    const ready = await cdp.evaluate(() => 1);
    if (ready !== 1) throw new Error('Browser transport readiness probe failed');
    const navigation = await cdp.send('Page.navigate', { url });
    if (navigation.errorText) throw new Error('Browser navigation failed: ' + navigation.errorText);
    return { cdp, close };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const diagnostic = new Error(detail + '\nBrowser startup stderr: ' + (stderr.trim() || '(empty)'));
    try { await close(); } catch (cleanup) {
      // Do not launch another browser when the previous instance could not be cleaned up.
      throw new BrowserCleanupError(diagnostic.message + '\nCleanup failed: ' + String(cleanup));
    }
    throw diagnostic;
  }
}


export class BrowserCleanupError extends Error {}

/** Only retry browser startup/transport initialization. The smoke test body
 * runs exactly once after this returns; failed assertions cannot be retried.
 * A fresh isolated profile is allocated and cleaned by each attempt. */
export async function launchWithStartupRetry(attempt, log = console.warn, maxAttempts = 2) {
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
    throw new Error('Invalid browser startup attempt count');
  }
  const errors = [];
  for (let number = 1; number <= maxAttempts; number++) {
    try { return await attempt(number); }
    catch (error) {
      if (error instanceof BrowserCleanupError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      errors.push('Attempt ' + number + ': ' + message);
      if (number < maxAttempts) log('Chromium startup failed; retrying with a clean profile. ' + message);
    }
  }
  throw new Error('Browser startup failed after ' + maxAttempts + ' attempt(s):\n' + errors.join('\n'));
}
export async function launchBrowser(url) {
  const exe = await browserExecutable();
  return launchWithStartupRetry(() => launchBrowserAttempt(url, exe));
}
