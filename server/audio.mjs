import { createWriteStream } from 'node:fs';
import { readFile, writeFile, mkdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID, randomInt } from 'node:crypto';
import { VideoRuntime } from './video.mjs';
import { MusicRuntime } from './music.mjs';
import { installedAudioModels, snapshotPath } from '../scripts/audio-models.mjs';
import { audioNames } from './audio-policy.mjs';

export class AudioRuntime extends VideoRuntime {
  constructor(root) { super(root); this.music = new MusicRuntime(root); }
  async stop() { await super.stop(); await this.music.stop(); }
  async status(kind) {
    try {
      const ready = JSON.parse(await readFile(join(this.root, 'runtime/audio-' + process.platform + '-' + process.arch, 'ready.json'), 'utf8'));
      const model = (await installedAudioModels(this.root)).find(m => m.id === kind);
      await stat(kind === 'music' ? ready.music.python : ready[kind]);
      const folder = snapshotPath(this.root, model);
      for (const file of model.files) if ((await stat(join(folder, file.filename))).size !== file.bytes) throw new Error('Incomplete weights.');
      return { available: true, ready, model, folder };
    } catch { return { available: false, message: 'Install ' + audioNames[kind] + ' in Manage Models.' }; }
  }
  async generate(brief, signal, emit) {
    if (brief.kind === 'music') return this.music.generate(brief.prompt, brief, signal, emit);
    const status = await this.status(brief.kind);
    if (!status.available) throw new Error(status.message);
    const id = randomUUID(), seed = brief.seed < 0 ? randomInt(0, 2147483647) : brief.seed;
    for (const name of ['audio', 'audio-jobs', 'logs']) await mkdir(join(this.data, name), { recursive: true });
    const output = join(this.data, 'audio', id + '.wav'), jobPath = join(this.data, 'audio-jobs', id + '.json');
    await writeFile(jobPath, JSON.stringify({ ...brief, seed, model: status.folder, output }));
    const log = createWriteStream(join(this.data, 'logs', 'audio-' + id + '.log'));
    let completed = false, result, tail = '', buffer = '';
    const abort = () => { void this.stop(); };
    try {
      signal.throwIfAborted();
      const child = spawn(status.ready[brief.kind], [join(this.root, 'scripts/audio-engine.py'), jobPath], { cwd: this.root, windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WIZGARD_PARENT_PID: String(process.pid), PYTHONUNBUFFERED: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', TORCHDYNAMO_DISABLE: '1' } });
      this.child = child;
      const exited = new Promise((res, rej) => { child.once('error', rej); child.once('exit', code => code === 0 ? res() : rej(new Error('Audio generation failed. ' + tail.slice(-1200)))); });
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      child.stderr.on('data', d => { log.write(d); tail = (tail + d).slice(-4000); });
      child.stdout.on('data', d => {
        log.write(d); buffer += d.toString(); const lines = buffer.split('\n'); buffer = lines.pop();
        for (const line of lines) if (line.startsWith('WIZGARD:')) {
          try { const event = JSON.parse(line.slice(8)); if (event.done) result = event; else emit('status', event); } catch {}
        }
      });
      await exited; signal.throwIfAborted();
      if (!result || (await stat(output)).size < 100) throw new Error('The audio engine returned no usable output.');
      completed = true;
      return { audioUrl: '/generated-audio/' + id + '.wav', audioPrompt: brief.prompt, transcript: brief.kind === 'speech' ? brief.text : undefined, audioKind: brief.kind, seed, seconds: result.seconds, sampleRate: result.sampleRate, channels: result.channels };
    } finally { signal.removeEventListener('abort', abort); await this.stop(); log.end(); await unlink(jobPath).catch(() => {}); if (!completed) await unlink(output).catch(() => {}); }
  }
}
