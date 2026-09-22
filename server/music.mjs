import { VideoRuntime } from './video.mjs';
import { readFile, mkdir, writeFile, rename, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join, resolve, sep, basename, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID, randomInt } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { installedAudioModels, snapshotPath } from '../scripts/audio-models.mjs';

export function musicWorkflow(brief, seed, id) {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'ace_step_1.5_turbo_aio.safetensors' } },
    '2': { class_type: 'TextEncodeAceStepAudio1.5', inputs: { clip: ['1',1], tags: brief.prompt, lyrics: brief.lyrics, seed, bpm: brief.bpm, duration: brief.seconds, timesignature: '4', language: 'en', keyscale: 'C major', generate_audio_codes: true, cfg_scale: 2, temperature: 0.85, top_p: 0.9, top_k: 0, min_p: 0 } },
    '3': { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['1',0], shift: 3 } },
    '4': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['2',0] } },
    '5': { class_type: 'EmptyAceStep1.5LatentAudio', inputs: { seconds: brief.seconds, batch_size: 1 } },
    '6': { class_type: 'KSampler', inputs: { model: ['3',0], positive: ['2',0], negative: ['4',0], latent_image: ['5',0], seed, steps: 8, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1 } },
    '7': { class_type: 'VAEDecodeAudio', inputs: { samples: ['6',0], vae: ['1',2] } },
    '8': { class_type: 'SaveAudio', inputs: { audio: ['7',0], filename_prefix: id } },
  };
}
function findAudio(value) {
  if (!value || typeof value !== 'object') return null;
  if (value.type === 'output' && /\.(flac|wav|mp3)$/.test(value.filename || '')) return value;
  for (const child of Object.values(value)) { const found = findAudio(child); if (found) return found; }
  return null;
}
export class MusicRuntime extends VideoRuntime {
  async request(path, body, signal) {
    const response = await fetch('http://127.0.0.1:8190' + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: signal || AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Music engine: ' + (await response.text()).slice(0, 1200));
    return response.json();
  }
  async generate(prompt, brief, signal, emit) {
    const ready = JSON.parse(await readFile(join(this.root, 'runtime/audio-' + process.platform + '-' + process.arch, 'ready.json'), 'utf8')).music;
    const model = (await installedAudioModels(this.root)).find(m => m.id === 'music');
    const occupied = await fetch('http://127.0.0.1:8190/system_stats', { signal: AbortSignal.timeout(1000) }).then(() => true).catch(() => false);
    if (occupied) throw new Error('Music engine port 8190 is occupied.');
    const id = randomUUID(), seed = brief.seed < 0 ? randomInt(0,2147483647) : brief.seed;
    for (const name of ['audio', 'music-runtime/user', 'music-temp', 'music-input', 'logs']) await mkdir(join(this.data, name), { recursive: true });
    const config = join(this.data, 'music-runtime/model-paths.yaml');
    await writeFile(config, JSON.stringify({ wizgard: { base_path: snapshotPath(this.root, model), checkpoints: 'checkpoints' } }));
    const log = createWriteStream(join(this.data, 'logs', 'audio-' + id + '.log'));
    let tail = '', socket;
    try {
      signal.throwIfAborted(); emit('status', { text: 'Starting ACE-Step music engine…' });
      const child = spawn(ready.python, [join(this.root, 'scripts/video-engine.py'), join(ready.comfy, 'main.py'), '--listen', '127.0.0.1', '--port', '8190', '--disable-auto-launch', '--disable-all-custom-nodes', '--disable-api-nodes', '--disable-metadata', '--preview-method', 'none', ...(ready.cpu ? ['--cpu'] : []), '--extra-model-paths-config', config, '--output-directory', join(this.data, 'audio'), '--input-directory', join(this.data, 'music-input'), '--temp-directory', join(this.data, 'music-temp'), '--user-directory', join(this.data, 'music-runtime/user')], { cwd: ready.comfy, windowsHide: true, detached: process.platform !== 'win32', env: { ...process.env, WIZGARD_PARENT_PID: String(process.pid), PYTHONUNBUFFERED: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' }, stdio: ['ignore','pipe','pipe'] });
      this.child = child; child.on('error', e => { tail += e.message; });
      for (const stream of [child.stdout,child.stderr]) stream.on('data', d => { log.write(d); tail = (tail + d).slice(-4000); });
      let connected = false;
      for (let i = 0; i < 240; i++) {
        signal.throwIfAborted(); if (child.exitCode !== null || child.signalCode !== null) throw new Error('Music engine stopped: ' + tail.slice(-1500));
        try { await this.request('/system_stats'); connected = true; break; } catch {}
        await sleep(500, undefined, { signal });
      }
      if (!connected) throw new Error('Music engine startup timed out.');
      const client = randomUUID(); socket = new WebSocket('ws://127.0.0.1:8190/ws?clientId=' + client); socket.addEventListener('error', () => {});
      socket.addEventListener('message', e => { try { const msg = JSON.parse(e.data); if (msg.type === 'progress') emit('status', { text: 'Generating music…', progress: Math.round(msg.data.value / msg.data.max * 100) }); } catch {} });
      await Promise.race([new Promise(res => socket.addEventListener('open', res, { once: true })), sleep(1500, undefined, { signal })]);
      emit('status', { text: 'Composing with ACE-Step…' });
      const queued = await this.request('/prompt', { prompt: musicWorkflow(brief, seed, id), client_id: client }, signal);
      if (!queued.prompt_id) throw new Error('Music workflow validation failed: ' + JSON.stringify(queued.node_errors));
      let output;
      for (let i = 0; i < 7200; i++) {
        signal.throwIfAborted(); if (child.exitCode !== null || child.signalCode !== null) throw new Error('Music engine stopped: ' + tail.slice(-1500));
        const entry = (await this.request('/history/' + queued.prompt_id, null, signal))[queued.prompt_id];
        if (entry?.status?.status_str === 'error') throw new Error(entry.status.messages?.find(m => m[0] === 'execution_error')?.[1]?.exception_message || 'Music generation failed.');
        if (entry?.status?.completed) { output = findAudio(entry.outputs); break; }
        await sleep(1000, undefined, { signal });
      }
      if (!output) throw new Error('No music file was produced.');
      const outputRoot = resolve(this.data, 'audio'), source = resolve(outputRoot, output.subfolder || '', output.filename);
      if (!source.startsWith(outputRoot + sep) || !basename(source).startsWith(id)) throw new Error('Unexpected music output path.');
      await stat(source); const name = id + extname(source); await rename(source, join(outputRoot, name));
      return { audioUrl: '/generated-audio/' + name, audioPrompt: prompt, audioKind: 'music', lyrics: brief.lyrics, seed, seconds: brief.seconds, sampleRate: 48000 };
    } finally { socket?.close(); await this.stop(); log.end(); }
  }
}
