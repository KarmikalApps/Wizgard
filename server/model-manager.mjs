import { readFile, writeFile, mkdir, rename, stat, lstat, realpath, unlink, rm } from 'node:fs/promises';
import { join, resolve, sep, dirname } from 'node:path';
import { fork } from 'node:child_process';
import { installedModels } from '../scripts/models.mjs';
import { installedAudioModels, snapshotPath } from '../scripts/audio-models.mjs';
import { platformPaths } from './platform.mjs';
import { videoSupported } from '../scripts/setup-video.mjs';
import { VideoRuntime } from './video.mjs';

export const modelDefinitions = [
  { id: 'chat', name: 'Qwen 3.8', subtitle: '27B · HauhauCS', purpose: 'Chat & understand', description: 'Ask questions, analyze attachments, browse the web, and interpret creative requests.', ids: ['chat','chat-projector'], catalog: 'model-manifest.json', stateFile: 'models/installed.json' },
  { id: 'image', capability:'image', name: 'Qwen Image 2.1', subtitle: '0xSojalSec · Q8', purpose: 'Create images', description: 'Turn ideas into pictures and transform your reference images.', ids: ['diffusion','encoder','vae','image-projector'], catalog: 'model-manifest.json', stateFile: 'models/installed.json' },
  { id:'flux2', capability:'image', name:'FLUX.2-dev', subtitle:'32B · Q4_K_S', purpose:'Create images', description:'Generate and edit pictures with multiple references. FLUX non-commercial model license; review outputs before sharing.', ids:['flux2-diffusion','flux2-encoder','flux2-vae'], catalog:'flux2-model-manifest.json', stateFile:'models/flux2-installed.json' },
  { id:'video', capability:'video', name:'LTX-2.5', subtitle:'22B distilled · INT8', purpose:'Make videos', description:'Generate video with sound, image references, and HD output up to 1080p.', ids:['ltx-transformer','ltx-encoder','ltx-vae','ltx-audio-vae','ltx-upscaler'], catalog:'video-model-manifest.json', stateFile:'models/ltx25-installed.json' },
  { id:'sulphur', capability:'video', name:'Sulphur 2', subtitle:'Local video · FP8', purpose:'Make videos', description:'Create short clips with optional sound and multiple image guides.', ids:['video','video-lora','video-encoder'], catalog:'sulphur-model-manifest.json', stateFile:'models/video-installed.json' },
  { id: 'speech', name: 'Qwen3-TTS', subtitle: '1.7B · CustomVoice', purpose: 'Speak & narrate', description: 'Natural speech in ten languages with a choice of voices and delivery styles.', audio: true },
  { id: 'music', name: 'ACE-Step 1.5', subtitle: 'Turbo', purpose: 'Compose music', description: 'Create instrumental tracks or songs with lyrics from a description.', audio: true },
  { id: 'sfx', name: 'MOSS SoundEffect', subtitle: 'Version 2', purpose: 'Design sound effects', description: 'Generate ambience, Foley, and individual sound effects.', audio: true },
];
const json = async (path, fallback) => JSON.parse(await readFile(path, 'utf8').catch(e => { if (e.code === 'ENOENT') return JSON.stringify(fallback); throw e; }));
export class ModelManager extends VideoRuntime {
  constructor(root, hooks = {}) { super(root); this.hooks = hooks; this.items = []; this.job = null; this.checking = false; this.checks = {}; }
  async init() { await mkdir(join(this.root,'models'), { recursive: true }); this.preferences = await json(join(this.root,'models/preferences.json'), { active: {} }); await this.refresh(); }
  async savePreferences() { const p = join(this.root,'models/preferences.json'); await writeFile(p + '.tmp', JSON.stringify(this.preferences, null, 2)); await rename(p + '.tmp',p); }
  async filesFor(def) {
    if (def.audio) { const model = (await installedAudioModels(this.root)).find(m => m.id === def.id); return model.files.map(f => ({ ...f, path: join(snapshotPath(this.root,model),f.filename), revision: model.revision, repo: model.repo })); }
    return (await installedModels(this.root,{ catalogFile: def.catalog, stateFile: def.stateFile })).filter(m => def.ids.includes(m.id)).map(m => ({ ...m,path: resolve(this.root,m.path) }));
  }
  async refresh() {
    const platform = platformPaths(this.root);
    const audio = await json(join(this.root,'runtime/audio-' + process.platform + '-' + process.arch,'ready.json'), {});
    const video = await json(join(this.root,'runtime/video-' + process.platform + '-' + process.arch,'ready.json'), {});
    this.items = await Promise.all(modelDefinitions.map(async def => {
      const files = await this.filesFor(def);
      const weights = files.length > 0 && (def.audio || files.length === def.ids.length) && (await Promise.all(files.map(f => stat(f.path).then(s => s.size === f.bytes).catch(() => false)))).every(Boolean);
      const engine = def.id === 'chat' ? platform.ollamaExe : def.capability === 'image' ? Object.values(platform.engines).find(Boolean) : def.capability === 'video' ? video.python : def.id === 'music' ? audio.music?.python : audio[def.id];
      const installed = weights && !!engine && resolve(engine).startsWith(resolve(this.root,'runtime') + sep) && await stat(engine).then(() => true).catch(() => false);
      const supported = (def.capability !== 'video' || videoSupported()) && !(def.audio && process.platform === 'darwin' && process.arch === 'x64');
      return { id: def.id, capability: def.capability || def.id, name: def.name, subtitle: def.subtitle, purpose: def.purpose, description: def.description, bytes: files.reduce((n,f) => n + f.bytes,0), installed, weights, active: installed && this.preferences.active[def.id] !== false, supported, requirement: supported ? null : def.audio ? 'The current audio runtime requires Windows, Linux, or Apple Silicon' : 'NVIDIA CUDA on Windows or Linux required', update: this.checks[def.id]?.state || 'unchecked', checkedAt: this.checks[def.id]?.at, checkError: this.checks[def.id]?.error };
    }));
    return this.snapshot();
  }
  snapshot() { return { models: this.items, job: this.job, operating: !!this.operating, checking: this.checking, setupRequired: !this.items.some(m => m.installed), active: [...new Set(this.items.filter(m => m.active).map(m => m.capability || m.id))] }; }
  has(id) { return this.items.some(m => (m.capability || m.id) === id && m.active); }
  async checkUpdates() {
    if (this.checking) return; this.checking = true;
    const cache = new Map();
    const publisher = repo => { if (!cache.has(repo)) cache.set(repo, fetch('https://huggingface.co/api/models/' + repo + '/revision/main?blobs=true', { signal: AbortSignal.timeout(20000) }).then(async r => { if (!r.ok) throw new Error('Publisher returned HTTP ' + r.status); return r.json(); })); return cache.get(repo); };
    try {
      await Promise.all(modelDefinitions.map(async def => {
        try {
          const files = await this.filesFor(def);
          const matches = await Promise.all(files.map(async f => { const latest = await publisher(f.repo); const found = latest.siblings?.find(x => x.rfilename === f.filename); if (!found) throw new Error('Configured file is no longer listed by the publisher.'); return f.sha256 ? found.lfs?.sha256 === f.sha256 : found.blobId === f.gitOid; }));
          if(def.audio && files.length) {
            const configured=(await installedAudioModels(this.root)).find(m=>m.id===def.id);
            const latest=await publisher(configured.repo);
            const expected=latest.siblings.filter(f=>configured.selection?configured.selection.includes(f.rfilename):/\.(json|safetensors|txt|pth)$/.test(f.rfilename));
            matches.push(expected.length === files.length);
          }
          this.checks[def.id] = { state: matches.every(Boolean) ? 'current' : 'available', at: new Date().toISOString() };
        } catch (e) { this.checks[def.id] = { state: 'unknown', at: new Date().toISOString(), error: e.message }; }
      }));
    } finally { this.checking = false; await this.refresh(); }
  }
  assertIdle() { if (this.operating || this.child || ['running','cancelling'].includes(this.job?.status) || this.hooks.busy?.()) throw Object.assign(new Error('Stop generation or wait for the current installation first.'), { status: 409 }); }
  async setActive(id, active) {
    this.assertIdle(); const item = this.items.find(m => m.id === id);
    if (!item?.installed || typeof active !== 'boolean') throw Object.assign(new Error('Install the model before activating it.'), { status:400 });
    this.operating = true;
    try { await this.hooks.release?.(); this.preferences.active[id] = active; await this.savePreferences(); await this.refresh(); await this.hooks.changed?.(); }
    finally { this.operating = false; }
    return this.snapshot();
  }
  async install(ids) {
    this.assertIdle();
    if (!Array.isArray(ids) || !ids.length || ids.length > modelDefinitions.length || new Set(ids).size !== ids.length || ids.some(id => !this.items.some(m => m.id === id && m.supported))) throw Object.assign(new Error('Select at least one supported model.'), { status:400 });
    this.job = { status:'running', ids, current: ids[0], phase:'preparing', percent:null, message:'Preparing installation…', completed:0 };
    // The lock is set before awaiting engine shutdown so requests cannot overlap.
    try { await this.hooks.release?.(); } catch (e) { this.job = { ...this.job,status:'error',message:e.message }; throw e; }
    const child = fork(join(this.root,'scripts/install-model.mjs'), ids, { cwd:this.root, silent:true, windowsHide:true, detached:process.platform !== 'win32', env:{ ...process.env,WIZGARD_PARENT_PID:String(process.pid) } });
    this.child = child; let tail = '', loaded = new Map();
    child.on('message', message => {
      if (message.type === 'model') { loaded = new Map(); this.job = { ...this.job,current:message.id,phase:message.phase,message:message.message,percent:message.phase === 'weights' ? 0 : null,filePercent:null }; }
      if (message.type === 'download') {
        const item = this.items.find(m => m.id === this.job.current);
        loaded.set(message.label, message.loaded || 0);
        const weightPhase = this.job.phase === 'weights' || this.job.phase === 'verifying';
        this.job = { ...this.job, phase:weightPhase ? message.phase === 'verifying' ? 'verifying' : 'weights' : 'runtime', file:message.label, filePercent:message.total ? Math.round(message.loaded / message.total * 100) : null, percent:weightPhase ? Math.min(99,Math.floor([...loaded.values()].reduce((a,b)=>a+b,0) / item.bytes * 100)) : null, message:(message.phase === 'verifying' ? 'Verifying ' : 'Downloading ') + message.label };
      }
      if (message.type === 'complete') { this.job.completed++; this.job.percent = 100; this.preferences.active[message.id] = true; }
    });
    for (const stream of [child.stdout,child.stderr]) stream.on('data', d => { tail = (tail + d.toString()).slice(-2500); });
    child.on('error', e => { tail = e.message; });
    let finished = false;
    const finish = async code => {
      if(finished) return; finished = true;
      const cancelled = this.job.status === 'cancelling';
      this.job = { ...this.job,phase:'finalizing',message:'Refreshing your workspace…' };
      try {
        await this.savePreferences(); await this.refresh(); await this.hooks.changed?.();
        this.job = { ...this.job, status:cancelled ? 'cancelled' : code === 0 ? 'complete' : 'error', percent:code === 0 ? 100 : this.job.percent, message:cancelled ? 'Installation stopped. Run it again to resume downloads.' : code === 0 ? 'Your models are ready.' : tail.slice(-1400) || 'Installation failed. Retry to resume.' };
        if(code === 0 && !cancelled) void this.checkUpdates().catch(error => console.warn('Update check: ' + error.message));
      } catch (e) { this.job.status='error';this.job.message=e.message; }
      finally { if(this.child === child)this.child=null; }
    };
    child.once('exit', finish); child.once('error', () => { void finish(1); });
    return this.snapshot();
  }
  async cancel() { if (this.child) { this.job.status='cancelling'; await super.stop(); } return this.snapshot(); }
  async uninstall(id, confirmation) {
    this.assertIdle(); const def = modelDefinitions.find(m => m.id === id);
    if (!def || confirmation !== 'UNINSTALL_' + id) throw Object.assign(new Error('Confirm the model to uninstall.'), { status:400 });
    this.job = { status:'running',current:id,ids:[id],phase:'removing',percent:null,message:'Removing model weights…',completed:0 };
    try {
      await this.hooks.release?.();
      const root = await realpath(join(this.root,'models'));
      // Remove only catalog-owned weights, never runtime folders or user outputs.
      const files = await this.filesFor(def);
      for (const file of files) for (const path of [file.path,file.path + '.part']) {
        try { const real = await realpath(path); if (!real.startsWith(root + sep)) throw new Error('Model path resolves outside the model directory.'); if (!(await lstat(path)).isFile()) throw new Error('Unexpected model file type.'); await unlink(path); } catch(e) { if (e.code !== 'ENOENT') throw e; }
      }
      const ownedFolder = def.audio ? join(root,'audio',id) : null;
      if (ownedFolder) {
        try {
          const target = await realpath(ownedFolder);
          if (target !== resolve(ownedFolder) || !target.startsWith(root + sep)) throw new Error('Refusing to remove a redirected model folder.');
          await rm(target,{recursive:true,force:true,maxRetries:3});
        } catch(e) { if(e.code !== 'ENOENT') throw e; }
      }
      if (id === 'chat') await unlink(join(root,'ollama/manifests/registry.ollama.ai/library/wizgard-qwen3.8/latest')).catch(e => { if(e.code !== 'ENOENT') throw e; });
      this.preferences.active[id] = false; await this.savePreferences(); await this.refresh(); await this.hooks.changed?.();
      this.job = { ...this.job,status:'complete',percent:100,message:'Model removed. Generated files and shared runtimes were kept.' };
    } catch(e) { this.job = { ...this.job,status:'error',message:e.message }; throw e; }
    return this.snapshot();
  }
}
