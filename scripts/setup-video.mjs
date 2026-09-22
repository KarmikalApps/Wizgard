import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { download, hashFile } from './download.mjs';
import { extractZip } from './zip.mjs';
import { updateModels } from './models.mjs';
import { findExecutable } from '../server/platform.mjs';

export const videoCatalog = { catalogFile: 'video-model-manifest.json', stateFile: 'models/video-installed.json' };
export function videoSupported() {
  return ['win32', 'linux'].includes(process.platform) && spawnSync(process.platform === 'win32' ? 'nvidia-smi.exe' : 'nvidia-smi', ['-L'], { stdio: 'ignore', windowsHide: true }).status === 0;
}
function run(exe, args, options = {}) {
  return new Promise((res, rej) => {
    const child = spawn(exe, args, { stdio: 'inherit', windowsHide: true, ...options });
    child.once('error', rej); child.once('exit', code => code === 0 ? res() : rej(new Error('Video setup failed (exit ' + code + '). Run again to resume.')));
  });
}
export async function setupVideo(root, { models = true } = {}) {
  if (!videoSupported()) { throw new Error('Sulphur video requires an NVIDIA GPU on Windows/Linux for this preview.'); }
  const manifest = JSON.parse(await readFile(join(root, 'video-runtime-manifest.json'), 'utf8'));
  const base = join(root, 'runtime/video-' + process.platform + '-' + process.arch);
  await mkdir(base, { recursive: true });
  const configHash = createHash('sha256').update(JSON.stringify(manifest)).update(root).digest('hex');
  const readyPath = join(base, 'ready.json');
  const ready = JSON.parse(await readFile(readyPath, 'utf8').catch(() => 'null'));
  if (ready?.key !== configHash || !existsSync(ready.python) || !existsSync(join(ready.comfy, 'main.py'))) {
    const asset = manifest.uv.find(a => a.platform === process.platform && a.arch === process.arch);
    if (!asset) throw new Error('No video runtime for this platform.');
    const archive = join(root, 'runtime/archives', asset.archive);
    await download(asset.url, archive, asset.sha256, asset.bytes, 'video Python installer');
    if (await hashFile(archive) !== asset.sha256) throw new Error('Video installer checksum failed.');
    const uvDir = join(base, 'uv'); await mkdir(uvDir, { recursive: true });
    if (asset.archive.endsWith('.zip')) await extractZip(archive, uvDir);
    else await run('tar', ['-xf', archive, '-C', uvDir, '--strip-components=1']);
    const uv = findExecutable(uvDir, process.platform === 'win32' ? 'uv.exe' : 'uv');
    const env = { ...process.env, UV_PYTHON_INSTALL_DIR: join(base, 'python'), UV_PYTHON_BIN_DIR: join(base, 'python-bin'), UV_CACHE_DIR: join(base, 'cache'), UV_LINK_MODE: 'copy', UV_PYTHON: manifest.python };
    await run(uv, ['python', 'install', manifest.python], { env });
    const venv = join(base, 'env');
    const python = join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    await run(uv, ['venv', '--relocatable', '--python', manifest.python, '--allow-existing', venv], { env });
    const comfy = join(base, 'ComfyUI');
    const source = join(root, 'runtime/archives/comfyui-video.zip');
    await download(manifest.comfy.url, source, manifest.comfy.sha256, manifest.comfy.bytes, 'video engine source');
    if (await hashFile(source) !== manifest.comfy.sha256) throw new Error('Video engine checksum failed.');
    await extractZip(source, comfy, 1);
    console.log('Installing the isolated video engine and GPU dependencies…');
    const pinned = ['torch==' + manifest.torch, 'torchvision==' + manifest.torchvision, 'torchaudio==' + manifest.torchaudio];
    await run(uv, ['pip', 'install', '--python', python, '--index-url', manifest.cudaIndex, ...pinned], { env });
    const constraints = join(base, 'constraints.txt'); await writeFile(constraints, pinned.join('\n') + '\n');
    await run(uv, ['pip', 'install', '--python', python, '--constraint', 'constraints.txt', '-r', 'ComfyUI/requirements.txt'], { env, cwd: base });
    await run(python, ['-c', 'import torch, av; assert torch.cuda.is_available(), "CUDA is unavailable to the video runtime"'], { env });
    await writeFile(readyPath, JSON.stringify({ key: configHash, python, comfy }, null, 2));
  }
  if (models) await updateModels(root, videoCatalog);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await setupVideo(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
}
