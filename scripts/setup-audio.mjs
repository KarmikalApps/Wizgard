import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { download, hashFile } from './download.mjs';
import { extractZip } from './zip.mjs';
import { findExecutable } from '../server/platform.mjs';
import { videoSupported } from './setup-video.mjs';
import { updateAudioModels } from './audio-models.mjs';

function run(exe, args, options = {}) {
  return new Promise((res, rej) => {
    const child = spawn(exe, args, { stdio: 'inherit', windowsHide: true, ...options });
    child.once('error', rej); child.once('exit', code => code === 0 ? res() : rej(new Error('Audio setup failed (exit ' + code + '). Run again to resume.')));
  });
}
export async function setupAudio(root, { models = true, kinds = ['speech','sfx','music'] } = {}) {
  const manifest = JSON.parse(await readFile(join(root, 'audio-runtime-manifest.json'), 'utf8'));
  const base = join(root, 'runtime/audio-' + process.platform + '-' + process.arch);
  await mkdir(base, { recursive: true });
  const cuda = videoSupported();
  const key = createHash('sha256').update(JSON.stringify(manifest)).update(root).update(String(cuda)).digest('hex');
  const readyPath = join(base, 'ready.json');
  const ready = JSON.parse(await readFile(readyPath, 'utf8').catch(() => 'null'));
  if (ready?.key !== key || !kinds.every(k => { const p = k === 'music' ? ready.music?.python : ready[k]; return p && existsSync(p); })) {
    const asset = manifest.uv.find(a => a.platform === process.platform && a.arch === process.arch);
    if (!asset) throw new Error('Audio runtime is unavailable on this platform.');
    const archive = join(root, 'runtime/archives', asset.archive);
    await download(asset.url, archive, asset.sha256, asset.bytes, 'audio Python installer');
    if (await hashFile(archive) !== asset.sha256) throw new Error('Audio installer checksum failed.');
    const uvDir = join(base, 'uv'); await mkdir(uvDir, { recursive: true });
    if (asset.archive.endsWith('.zip')) await extractZip(archive, uvDir);
    else await run('tar', ['-xf', archive, '-C', uvDir, '--strip-components=1']);
    const uv = findExecutable(uvDir, process.platform === 'win32' ? 'uv.exe' : 'uv');
    const env = { ...process.env, UV_PYTHON_INSTALL_DIR: join(base, 'python'), UV_PYTHON_BIN_DIR: join(base, 'python-bin'), UV_CACHE_DIR: join(base, 'cache'), UV_LINK_MODE: 'copy', UV_PYTHON: manifest.python };
    await run(uv, ['python', 'install', manifest.python], { env });
    if (kinds.includes('sfx')) {
    const source = join(root, 'runtime/archives/moss-audio.zip');
    await download(manifest.moss.url, source, manifest.moss.sha256, manifest.moss.bytes, 'sound-effects engine');
    if (await hashFile(source) !== manifest.moss.sha256) throw new Error('Sound-effects engine checksum failed.');
    const moss = join(base, 'MOSS-TTS'); await extractZip(source, moss, 1);
    }
    const pinned = ['torch==' + manifest.torch, 'torchvision==' + manifest.torchvision, 'torchaudio==' + manifest.torchaudio];
    await writeFile(join(base, 'constraints.txt'), pinned.join('\n') + '\n');
    const paths = ready?.key === key ? { ...ready } : {};
    async function environment(name) {
      const venv = join(base, name), python = join(venv, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
      await run(uv, ['venv', '--relocatable', '--python', manifest.python, '--allow-existing', venv], { env });
      await run(uv, ['pip', 'install', '--python', python, ...(cuda ? ['--index-url', manifest.cudaIndex] : process.platform === 'linux' ? ['--index-url', 'https://download.pytorch.org/whl/cpu'] : []), ...pinned], { env });
      return python;
    }
    for (const kind of kinds.filter(k => k !== 'music')) {
      console.log('Installing isolated ' + kind + ' dependencies…');
      paths[kind] = await environment(kind);
      const packages = kind === 'speech' ? ['qwen-tts==' + manifest.qwenTts, 'psutil'] : ['./MOSS-TTS/moss_soundeffect_v2', 'psutil'];
      await run(uv, ['pip', 'install', '--python', paths[kind], '--constraint', 'constraints.txt', ...packages], { env, cwd: base });
      await run(paths[kind], ['-c', kind === 'speech' ? 'import qwen_tts, soundfile, psutil' : 'from moss_soundeffect_v2 import MossSoundEffectPipeline; import soundfile, psutil'], { env });
    }
    if (kinds.includes('music')) {
    let music = JSON.parse(await readFile(join(root, 'runtime/video-' + process.platform + '-' + process.arch, 'ready.json'), 'utf8').catch(() => 'null'));
    if (!music || !resolve(music.python).startsWith(resolve(root,'runtime') + sep) || !existsSync(music.python) || !existsSync(join(music.comfy, 'main.py'))) {
      const python = await environment('music');
      const comfy = join(base, 'ComfyUI'), archive = join(root, 'runtime/archives/comfyui-video.zip');
      await download(manifest.comfy.url, archive, manifest.comfy.sha256, manifest.comfy.bytes, 'music engine');
      if (await hashFile(archive) !== manifest.comfy.sha256) throw new Error('Music engine checksum failed.');
      await extractZip(archive, comfy, 1);
      await run(uv, ['pip', 'install', '--python', python, '--constraint', 'constraints.txt', '-r', 'ComfyUI/requirements.txt'], { env, cwd: base });
      music = { python, comfy };
    }
    paths.music = { python: music.python, comfy: music.comfy, cpu: !cuda && process.platform !== 'darwin' };
    }
    await writeFile(readyPath, JSON.stringify({ ...paths, key, cuda }, null, 2));
  }
  if (models) await updateAudioModels(root, { ids: kinds });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await setupAudio(resolve(dirname(fileURLToPath(import.meta.url)), '..'), { models: !process.argv.includes('--runtime-only') });
