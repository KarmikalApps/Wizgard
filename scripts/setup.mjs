import { setupVideo } from './setup-video.mjs';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname, delimiter } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createZstdDecompress } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { platformPaths, findExecutable } from '../server/platform.mjs';
import { download, hashFile } from './download.mjs';
import { extractZip } from './zip.mjs';
import { updateModels } from './models.mjs';

export function run(exe, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { stdio: 'inherit', windowsHide: true, ...options });
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(exe + ' exited with ' + (signal || code))));
  });
}
export async function unpack(root, entry) {
  if (!entry) throw new Error('Missing runtime download manifest entry.');
  const dest = join(root, entry.destination);
  const marker = join(dest, '.wizgard-' + entry.key);
  try { if ((await readFile(marker, 'utf8')) === entry.sha256) return; } catch {}
  let archive = join(root, entry.archive), expected = entry.sha256;
  if (entry.bundledArchive && existsSync(join(root, entry.bundledArchive))) { archive = join(root, entry.bundledArchive); expected = entry.bundledSha256; }
  else await download(entry.url, archive, entry.sha256, entry.bytes, entry.key);
  console.log('Preparing ' + entry.key + '…');
  if (await hashFile(archive) !== expected) throw new Error('Archive checksum mismatch: ' + entry.archive + '. Remove that archive and run again to download a verified copy.');
  await mkdir(dest, { recursive: true });
  const args = ['-xf', archive, '-C', dest, '--strip-components=' + (entry.strip || 0)];
  if (archive.endsWith('.zip')) await extractZip(archive, dest, entry.strip || 0);
  else if (archive.endsWith('.zst')) {
    const child = spawn('tar', ['-xf', '-', '-C', dest], { stdio: ['pipe', 'inherit', 'inherit'] });
    const finished = new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error('Archive extraction failed: ' + entry.key))); });
    await Promise.all([pipeline(createReadStream(archive), createZstdDecompress(), child.stdin), finished]);
  } else await run('tar', args);
  await writeFile(marker, entry.sha256);
}
export async function setupEngines(root, capability) {
  const platform = process.platform, arch = process.arch;
  if (!['win32-x64', 'darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64'].includes(platform + '-' + arch)) throw new Error('Supported platforms: Windows x64, macOS Apple Silicon/Intel, and Linux x64/ARM64.');

  const manifest = JSON.parse(await readFile(join(root, 'runtime/platform-manifest.json'), 'utf8'));
  if (platform === 'win32') {
    const nvidia = spawnSync('nvidia-smi.exe', ['-L'], { stdio: 'ignore', windowsHide: true }).status === 0;
    const wanted = capability === 'chat' ? ['ollama-win32'] : ['sd-win-cpu', ...(nvidia ? ['sd-win-cuda', 'sd-win-cudart'] : ['sd-win-vulkan'])];
    for (const key of wanted) await unpack(root, manifest.find(e => e.key === key));
  } else {
    const prefix = platform === 'darwin' ? 'darwin' : 'linux-' + (arch === 'x64' ? 'amd64' : arch);
    const wanted = capability === 'chat' ? ['ollama-' + prefix] : [];
    if (capability === 'image' && platform === 'darwin') wanted.push('sd-darwin');
    if (capability === 'image' && platform === 'linux' && arch === 'x64') wanted.push('sd-linux-cpu', 'sd-linux-vulkan');
    for (const key of wanted) {
      const entry = manifest.find(e => e.key === key);
      if (!entry) throw new Error('Missing platform archive entry: ' + key);
      await unpack(root, entry);
    }
    if (capability === 'chat') return;
    let paths = platformPaths(root);
    let works = false;
    const existing = paths.engines.metal || paths.engines.cpu;
    if (existing && !process.env.WIZGARD_BUILD_IMAGE) {
      try { await run(existing, ['--help'], { stdio: 'ignore', env: { ...process.env, LD_LIBRARY_PATH: dirname(existing) } }); works = true; } catch {}
    }
    if (!works) {
      console.log('Building an image engine for this machine…');
      const cmKey = 'cmake-' + (platform === 'darwin' ? 'darwin' : 'linux-' + arch);
      await unpack(root, manifest.find(e => e.key === cmKey));
      const cmake = findExecutable(join(root, 'runtime', platform === 'darwin' ? 'darwin' : 'linux-' + arch, 'cmake'), 'cmake');
      const source = join(root, 'runtime/sd-source');
      if (!existsSync(join(source, 'CMakeLists.txt'))) await unpack(root, manifest.find(e => e.key === 'source-sd'));
      if (!existsSync(join(source, 'ggml/CMakeLists.txt'))) await unpack(root, manifest.find(e => e.key === 'source-ggml'));
      try { await run('c++', ['--version'], { stdio: 'ignore' }); }
      catch { throw new Error(platform === 'darwin' ? 'A native build is required on this macOS version. Install Apple Command Line Tools (xcode-select --install), then run Wizgard again.' : 'A native build needs a C++ compiler and make. On Ubuntu/Debian: sudo apt install build-essential. Then run Wizgard again.'); }
      const build = join(root, 'runtime', platform + '-' + arch, 'sd-native');
      const metal = platform === 'darwin' && arch === 'arm64';
      await run(cmake, ['-S', source, '-B', build, '-DCMAKE_BUILD_TYPE=Release', '-DCMAKE_POLICY_VERSION_MINIMUM=3.5', '-DSD_WEBP=OFF', '-DSD_WEBM=OFF', '-DSD_METAL=' + (metal ? 'ON' : 'OFF'), '-DGGML_METAL=' + (metal ? 'ON' : 'OFF'), '-DGGML_OPENMP=OFF', '-DGGML_NATIVE=OFF']);
      await run(cmake, ['--build', build, '--config', 'Release', '--target', 'sd-cli', '--parallel', '4']);
    }
  }
}
export async function setup(root) {
  const platform = process.platform, arch = process.arch;
  const npm = join(dirname(process.execPath), process.platform === 'win32' ? 'node_modules/npm/bin/npm-cli.js' : '../lib/node_modules/npm/bin/npm-cli.js');
  const lock = await hashFile(join(root, 'package-lock.json'));
  const expected = platform + '-' + arch + ':' + lock;
  const marker = join(root, 'node_modules/.wizgard-platform');
  let installed = false;
  try { installed = (await readFile(marker, 'utf8')) === expected && (await stat(join(root, 'node_modules/react/package.json'))).isFile(); } catch {}
  const env = { ...process.env, PATH: dirname(process.execPath) + delimiter + process.env.PATH, npm_config_cache: join(root, 'runtime/npm-cache') };
  if (!installed) {
    console.log('Installing project dependencies for ' + platform + ' ' + arch + '…');
    const args = [npm, 'ci', '--include=optional', '--no-audit', '--no-fund'];
    if (existsSync(join(root, 'runtime/npm-cache/_cacache'))) {
      try { await run(process.execPath, [...args, '--offline'], { cwd: root, env }); }
      catch { console.log('The local package cache is incomplete. Trying the npm registry…'); await run(process.execPath, args, { cwd: root, env }); }
    } else await run(process.execPath, args, { cwd: root, env });
    await writeFile(marker, expected);
  }
  const sourceHash = createHash('sha256');
  async function fingerprint(path) {
    if ((await stat(path)).isDirectory()) {
      for (const name of (await readdir(path)).sort()) await fingerprint(join(path, name));
    } else sourceHash.update(await readFile(path));
  }
  for (const name of ['src', 'public', 'index.html', 'vite.config.js', 'app-info.json', 'package-lock.json']) await fingerprint(join(root, name));
  const fingerprintValue = sourceHash.digest('hex');
  const built = await readFile(join(root, 'dist/.wizgard-source'), 'utf8').catch(() => '');
  if (!existsSync(join(root, 'dist/index.html')) || built !== fingerprintValue) {
    await run(process.execPath, [npm, 'run', 'build'], { cwd: root, env });
    await writeFile(join(root, 'dist/.wizgard-source'), fingerprintValue);
  }
}
