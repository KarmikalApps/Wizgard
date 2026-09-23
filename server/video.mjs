import { localFetch } from './local-fetch.mjs';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile, mkdir, stat, copyFile, unlink, rename } from 'node:fs/promises';
import { join, relative, resolve, sep, basename, extname } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { randomUUID, randomInt } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { installedModels } from '../scripts/models.mjs';
import { videoModels, videoModel } from './video-models.mjs';
import { buildSulphurWorkflow } from './sulphur-workflow.mjs';
import { findVideoOutput } from './video-workflow.mjs';

import { buildLtx25Workflow } from './ltx25-workflow.mjs';
import { videoFrames } from '../src/video-options.mjs';

const URL = 'http://127.0.0.1:8189';
export class VideoRuntime {
  constructor(root) { this.root = root; this.data = join(root, 'data'); this.child = null; this.phase = 'idle'; }
  async choices() {
    return Promise.all(Object.entries(videoModels).map(async ([id, model]) => {
      const { available, message } = await this.status(id);
      return { id, name: model.name, available, message, fps: model.fps, audio: model.audio, maxImages: model.maxImages };
    }));
  }
  async status(modelId = 'ltx25') {
    const modelInfo = videoModel(modelId);
    try {
      if (!['win32', 'linux'].includes(process.platform)) return { available: false, message: 'This video preview requires NVIDIA CUDA on Windows or Linux.' };
      const ready = JSON.parse(await readFile(join(this.root, 'runtime/video-' + process.platform + '-' + process.arch, 'ready.json'), 'utf8'));
      await stat(ready.python);
      const models = await installedModels(this.root, modelInfo.catalog);
      if (models.length !== modelInfo.ids.length || !modelInfo.ids.every(id => models.some(m => m.id === id))) throw new Error('Incomplete video model set.');
      for (const model of models) if ((await stat(join(this.root, model.path))).size !== model.bytes) throw new Error('Missing video weights.');
      return { available: true, phase: this.phase, model: modelInfo.name, ready, models };
    } catch { return { available: false, message: modelInfo.name + ' is not installed completely on this computer. Choose an installed video model in Settings.' }; }
  }
  async request(path, body, signal) {
    await this.waitForResume?.(signal);
    const response = await localFetch(URL + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: signal || AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Video engine: ' + (await response.text()).slice(0, 1200));
    return response.json();
  }
  async stop() {
    const child = this.child; this.child = null;
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(res => child.once('exit', res));
      if (process.platform === 'win32') await new Promise(res => execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, res));
      else { try { process.kill(-child.pid, 'SIGTERM'); } catch {} }
      await Promise.race([exited, sleep(5000)]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    this.phase = 'idle';
  }
  async generate(prompt, settings, signal, emit, sourcePaths = []) {
    const modelId = settings.videoModel || 'ltx25', modelInfo = videoModel(modelId);
    const isLtx = modelId === 'ltx25', audio = modelInfo.audio && settings.videoAudio === true;
    if (sourcePaths.length > modelInfo.maxImages) throw new Error(modelInfo.name + ' supports up to ' + modelInfo.maxImages + ' image attachment(s) per clip.');
    const status = await this.status(modelId);
    if (!status.available) throw new Error(status.message);
    if (this.child) throw new Error('The video engine is already busy.');
    const occupied = await fetch(URL + '/system_stats', { signal: AbortSignal.timeout(1000) }).then(() => true).catch(() => false);
    if (occupied) throw new Error('Port 8189 is occupied. Stop the other instance before generating video.');
    const id = randomUUID(), client = randomUUID();
    const seed = settings.seed < 0 ? randomInt(0, 2147483647) : settings.seed;
    const fps = settings.videoFps ?? modelInfo.fps, frames = videoFrames(settings.videoSeconds, fps);
    const width = settings.videoWidth, height = settings.videoHeight;
    let socket; const copiedInputs = [];
    const folders = ['videos', 'video-input', 'video-temp', 'video-runtime/user', 'logs'];
    for (const folder of folders) await mkdir(join(this.data, folder), { recursive: true });
    const config = join(this.data, 'video-runtime/model-paths.yaml');
    await writeFile(config, JSON.stringify({ wizgard: { base_path: join(this.root, 'models/video'), checkpoints: 'checkpoints', loras: 'loras', diffusion_models: 'diffusion_models', text_encoders: 'text_encoders', vae: 'vae', latent_upscale_models: 'latent_upscale_models' } }));
    const log = createWriteStream(join(this.data, 'logs', 'video-' + id + '.log'));
    let tail = '';
    try {
      signal.throwIfAborted(); this.phase = 'starting';
      emit('status', { text: 'Starting ' + modelInfo.name + ' video engine…' });
      const args = [join(this.root, 'scripts/video-engine.py'), join(status.ready.comfy, 'main.py'), '--listen', '127.0.0.1', '--port', '8189', '--disable-auto-launch', '--disable-all-custom-nodes', '--disable-api-nodes', '--disable-metadata', '--preview-method', 'none', '--reserve-vram', '4', '--extra-model-paths-config', config, '--output-directory', join(this.data, 'videos'), '--input-directory', join(this.data, 'video-input'), '--temp-directory', join(this.data, 'video-temp'), '--user-directory', join(this.data, 'video-runtime/user')];
      const child = spawn(status.ready.python, args, { cwd: status.ready.comfy, windowsHide: true, detached: process.platform !== 'win32', env: { ...process.env, WIZGARD_PARENT_PID: String(process.pid), PYTHONUNBUFFERED: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
      this.child = child;
      child.on('error', error => { tail += error.message; });
      const onOutput = data => { log.write(data); tail = (tail + data.toString()).slice(-6000); };
      child.stdout.on('data', onOutput); child.stderr.on('data', onOutput);
      let connected = false;
      for (let i = 0; i < 240; i++) {
        signal.throwIfAborted();
        if (child.exitCode !== null || child.signalCode !== null) throw new Error('Video engine stopped during startup. ' + tail.slice(-1000));
        try { await this.request('/system_stats',null,signal); connected = true; break; } catch {}
        await sleep(500, undefined, { signal });
      }
      if (!connected) throw new Error('Video engine startup timed out. See data/logs/video-' + id + '.log.');
      for (const [index, sourcePath] of sourcePaths.entries()) { const path = join(this.data, 'video-input', id + '-' + index + '.png'); await copyFile(sourcePath, path); copiedInputs.push(path); }
      const names = Object.fromEntries(status.models.map(m => [m.id, relative(join(this.root, 'models/video', m.category), join(this.root, m.path))]));
      const variant = sourcePaths.length ? 'i2v' : 't2v';
      const common = { prompt, seed, width, height, frames, fps, audio, sourceImages: copiedInputs.map(p => basename(p)), outputId: id };
      const graph = isLtx ? buildLtx25Workflow({ ...common, transformer:names['ltx-transformer'], encoder:names['ltx-encoder'], vae:names['ltx-vae'], audioVae:names['ltx-audio-vae'], upscaler:names['ltx-upscaler'] }) : buildSulphurWorkflow({ ...common, checkpoint: names.video, lora: names['video-lora'], encoder: names['video-encoder'] });
      socket = new WebSocket('ws://127.0.0.1:8189/ws?clientId=' + client);
      socket.addEventListener('error', () => {});
      let jobId;
      const labels = isLtx ? { '1':'Loading LTX-2.5…','3':'Loading the video text encoder…','4':'Understanding the video prompt…','15':'Generating motion…','22':'Upscaling video latents…','25':'Refining video details…','17':'Decoding video frames…','18':'Decoding sound…','20':'Saving your video…' } : { '1': 'Loading Sulphur 2…', '3': 'Loading the video text encoder…', '4': 'Understanding the video prompt…', '15': 'Generating video and sound…', '17': 'Decoding video frames…', '18': 'Decoding sound…', '20': 'Saving your video…' };
      let stage = 0;
      socket.addEventListener('message', event => {
        if (typeof event.data !== 'string') return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.data?.prompt_id && jobId && msg.data.prompt_id !== jobId) return;
          if (isLtx && msg.type === 'executing' && msg.data.node === '25') stage = 1;
          if (msg.type === 'progress') emit('status', { text: stage ? 'Refining video details…' : 'Generating motion…', progress: Math.round(isLtx ? (stage ? 70 + msg.data.value / msg.data.max * 30 : msg.data.value / msg.data.max * 70) : msg.data.value / msg.data.max * 100) });
          if (msg.type === 'executing' && labels[msg.data.node]) emit('status', { text: labels[msg.data.node] });
        } catch {}
      });
      await Promise.race([new Promise(res => socket.addEventListener('open', res, { once: true })), sleep(2000, undefined, { signal })]);
      this.phase = 'generating'; emit('status', { text: 'Loading ' + modelInfo.name + ' and preparing your clip…' });
      const queued = await this.request('/prompt', { prompt: graph, client_id: client }, signal);
      if (queued.error || !queued.prompt_id) throw new Error('Video workflow validation failed: ' + JSON.stringify(queued.node_errors || queued.error));
      jobId = queued.prompt_id;
      let result;
      for (let i = 0; i < 7200; i++) {
        signal.throwIfAborted();
        if (child.exitCode !== null || child.signalCode !== null) throw new Error('Video engine stopped. ' + tail.slice(-1200));
        const entry = (await this.request('/history/' + jobId, null, signal))[jobId];
        if (entry) {
          if (entry.status?.status_str === 'error') {
            const detail = entry.status.messages?.find(m => m[0] === 'execution_error')?.[1];
            throw new Error(modelInfo.name + ': ' + (detail?.exception_message || 'Generation failed. See the video log.'));
          }
          if (entry.status?.completed) { result = findVideoOutput(entry.outputs); break; }
        }
        await sleep(1000, undefined, { signal });
      }
      if (!result) throw new Error('Video generation did not produce a playable file. See data/logs/video-' + id + '.log.');
      const outputRoot = resolve(this.data, 'videos');
      const source = resolve(outputRoot, result.subfolder || '', result.filename);
      if (!source.startsWith(outputRoot + sep) || !basename(source).startsWith(id)) throw new Error('Unexpected video output path.');
      const name = id + extname(source); await rename(source, join(outputRoot, name));
      return { videoUrl: '/generated-videos/' + name, videoPrompt: prompt, seed, width, height, fps, frames, seconds: Number((frames / fps).toFixed(2)), audio, videoModel: modelId, model: modelInfo.name, variant, referenceCount: sourcePaths.length };
    } finally {
      socket?.close(); await this.stop(); log.end();
      await Promise.all(copiedInputs.map(path => unlink(path).catch(() => {})));
    }
  }
}
