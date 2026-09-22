import { spawn } from 'node:child_process';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { setup } from './setup.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appInfo = JSON.parse(await readFile(join(root, 'app-info.json'), 'utf8'));
const url = 'http://127.0.0.1:' + (process.env.WIZGARD_PORT || 3210);
let child = null, closing = false;
async function stop() {
  if (closing) return; closing = true;
  console.log('\nStopping Wizgard and its local model engines…');
  if (!child) process.exit(0);
  if (child) {
    try { await fetch(url + '/api/shutdown', { method: 'POST', signal: AbortSignal.timeout(12000) }); } catch {}
    if (child.exitCode === null) await new Promise(resolve => {
      const timer = setTimeout(resolve, 18000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    if (child.exitCode === null) child.kill('SIGTERM');
  }
}
process.on('SIGINT', stop); process.on('SIGTERM', stop); process.on('SIGHUP', stop);
try {
  const previous = await fetch(url + '/api/health', { signal: AbortSignal.timeout(1000) }).then(r => r.json()).catch(() => null);
  if (previous) throw new Error('A server is already running at ' + url + '. Use its existing Run window, or stop it before starting another copy.');
  await setup(root);
  if (closing) process.exit(0);
  child = spawn(process.execPath, [join(root, 'server/index.mjs')], { cwd: root, windowsHide: true,
    env: { ...process.env, WIZGARD_PARENT_PID: String(process.pid) }, stdio: 'inherit' });
  const finished = new Promise((res, rej) => { child.on('error', rej); child.on('exit', code => res(code)); });
  console.log('\nWizgard ' + appInfo.version + ' — An AI Tool developed by Karmikal Apps © 2026\n' + url + '\nKeep this terminal open. Close it or press Ctrl+C to stop the app.\nClosing only the browser tab does not stop the server.\n');
  if (!process.env.WIZGARD_NO_BROWSER) {
    for (let i = 0; i < 60 && child.exitCode === null; i++) {
      try { await fetch(url + '/api/health'); break; } catch { await new Promise(r => setTimeout(r, 500)); }
    }
    const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
    const browser = spawn(command, args, { stdio: 'ignore', windowsHide: true });
    browser.on('error', () => console.log('Open ' + url + ' in your browser.'));
    browser.unref();
  }
  const code = await finished;
  process.exitCode = closing ? 0 : (code || 0);
} catch (error) { console.error('\nWizgard could not start: ' + error.message); process.exitCode = 1; }
