import { createWriteStream } from 'node:fs';
import { readFile, writeFile, mkdir, stat, copyFile, unlink, rename } from 'node:fs/promises';
import { join, relative, resolve, sep, basename, extname } from 'node:path';
import { spawn, execFile } from 'node:child_process';
import { randomUUID, randomInt } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { installedModels } from '../scripts/models.mjs';
import { videoCatalog } from '../scripts/setup-video.mjs';
import { buildVideoWorkflow, findVideoOutput } from './video-workflow.mjs';

const URL = 'http://127.0.0.1:8189';
export class VideoRuntime {
  constructor(root) { this.root = root; this.data = join(root, 'data'); this.child = null; this.phase = 'idle'; }
  async status() {
    try {
      if (!['win32', 'linux'].includes(process.platform)) return { available: false, message: 'This video preview requires NVIDIA CUDA on Windows or Linux.' };
      const ready = JSON.parse(await readFile(join(this.root, 'runtime/video-' + process.platform + '-' + process.arch, 'ready.json'), 'utf8'));
      await stat(ready.python);
      const models = await installedModels(this.root, videoCatalog);
      for (const model of models) if ((await stat(join(this.root, model.path))).size !== model.bytes) throw new Error('Missing video weights.');
      return { available: true, phase: this.phase, model: 'Sulphur 2', ready, models };
    } catch { return { available: false, message: 'Video setup is incomplete. Close Wizgard and run its launcher to install Sulphur 2.' }; }
  }
  async request(path, body, signal) {
    const response = await fetch(URL + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: signal || AbortSignal.timeout(15000) });
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
    const status = await this.status();
    if (!status.available) throw new Error(status.message);
    if (this.child) throw new Error('The video engine is already busy.');
    const occupied = await fetch(URL + '/system_stats', { signal: AbortSignal.timeout(1000) }).then(() => true).catch(() => false);
    if (occupied) throw new Error('Port 8189 is occupied. Stop the other instance before generating video.');
    const id = randomUUID(), client = randomUUID();
    const seed = settings.seed < 0 ? randomInt(0, 2147483647) : settings.seed;
    const fps = 24, frames = settings.videoSeconds * fps + 1;
    const width = settings.videoWidth, height = settings.videoHeight;
    let socket; const copiedInputs = [];
    const folders = ['videos', 'video-input', 'video-temp', 'video-runtime/user', 'logs'];
    for (const folder of folders) await mkdir(join(this.data, folder), { recursive: true });
    const config = join(this.data, 'video-runtime/model-paths.yaml');
    await writeFile(config, JSON.stringify({ wizgard: { base_path: join(this.root, 'models/video'), checkpoints: 'checkpoints', text_encoders: 'text_encoders', loras: 'loras' } }));
    const log = createWriteStream(join(this.data, 'logs', 'video-' + id + '.log'));
    let tail = '';
    try {
      signal.throwIfAborted(); this.phase = 'starting';
      emit('status', { text: 'Starting Sulphur 2 video engine…' });
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
        try { await this.request('/system_stats'); connected = true; break; } catch {}
        await sleep(500, undefined, { signal });
      }
      if (!connected) throw new Error('Video engine startup timed out. See data/logs/video-' + id + '.log.');
      for (const [index, sourcePath] of sourcePaths.entries()) { const path = join(this.data, 'video-input', id + '-' + index + '.png'); await copyFile(sourcePath, path); copiedInputs.push(path); }
      const names = Object.fromEntries(status.models.map(m => [m.id, relative(join(this.root, 'models/video', m.category), join(this.root, m.path)).split(sep).join('/')]));
      const graph = buildVideoWorkflow({ checkpoint: names.video, encoder: names['video-encoder'], lora: names['video-lora'], prompt, seed, width, height, frames, fps, audio: settings.videoAudio, sourceImages: copiedInputs.map(p => basename(p)), outputId: id });
      socket = new WebSocket('ws://127.0.0.1:8189/ws?clientId=' + client);
      socket.addEventListener('error', () => {});
      let jobId;
      const labels = { '1': 'Loading Sulphur 2…', '2': 'Loading the video speed adapter…', '3': 'Loading the video text encoder…', '4': 'Understanding the video prompt…', '15': 'Generating video frames…', '17': 'Decoding video frames…', '18': 'Decoding video audio…', '20': 'Saving your video…' };
      socket.addEventListener('message', event => {
        if (typeof event.data !== 'string') return;
        try {
          const msg = JSON.parse(event.data);
          if (msg.data?.prompt_id && jobId && msg.data.prompt_id !== jobId) return;
          if (msg.type === 'progress') emit('status', { text: 'Generating video frames…', progress: Math.round(msg.data.value / msg.data.max * 100) });
          if (msg.type === 'executing' && labels[msg.data.node]) emit('status', { text: labels[msg.data.node] });
        } catch {}
      });
      await Promise.race([new Promise(res => socket.addEventListener('open', res, { once: true })), sleep(2000, undefined, { signal })]);
      this.phase = 'generating'; emit('status', { text: 'Loading Sulphur 2 and preparing your clip…' });
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
            throw new Error('Sulphur 2: ' + (detail?.exception_message || 'Generation failed. See the video log.'));
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
      return { videoUrl: '/generated-videos/' + name, videoPrompt: prompt, seed, width, height, fps, frames, seconds: Number((frames / fps).toFixed(2)), audio: settings.videoAudio, referenceCount: sourcePaths.length };
    } finally {
      socket?.close(); await this.stop(); log.end();
      await Promise.all(copiedInputs.map(path => unlink(path).catch(() => {})));
    }
  }
}
