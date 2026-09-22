import { readFile, writeFile, mkdir, rename, stat, statfs } from 'node:fs/promises';
import { resolve, join, dirname, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { download, hashFile } from './download.mjs';

export function snapshotPath(root, model) {
  if (!/^[a-z]+$/.test(model.id) || !/^[0-9a-f]{40,64}$/.test(model.revision)) throw new Error('Invalid audio model revision.');
  return join(root, 'models/audio', model.id, model.revision);
}
export function snapshotFile(folder, filename) {
  const path = resolve(folder, filename);
  if (!path.startsWith(resolve(folder) + sep) || filename.includes('\\') || filename.split('/').includes('..')) throw new Error('Invalid audio model path.');
  return path;
}
export async function installedAudioModels(root) {
  try { return JSON.parse(await readFile(join(root, 'models/audio-installed.json'), 'utf8')).models; }
  catch (error) { if (error.code !== 'ENOENT') throw error; return JSON.parse(await readFile(join(root, 'audio-model-manifest.json'), 'utf8')); }
}
export async function updateAudioModels(root, { fetchImpl = fetch, log = console.log, ids } = {}) {
  const fullCatalog = JSON.parse(await readFile(join(root, 'audio-model-manifest.json'), 'utf8'));
  const catalog = ids ? fullCatalog.filter(m => ids.includes(m.id)) : fullCatalog;
  const previous = await installedAudioModels(root);
  log('Checking audio model publishers…');
  const models = await Promise.all(catalog.map(async model => {
    try {
      const response = await fetchImpl('https://huggingface.co/api/models/' + model.repo + '/revision/main?blobs=true', { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const meta = await response.json();
      const files = meta.siblings.filter(f => model.selection ? model.selection.includes(f.rfilename) : /\.(json|safetensors|txt|pth)$/.test(f.rfilename)).map(f => ({ filename: f.rfilename, bytes: f.size, sha256: f.lfs?.sha256 || null, gitOid: f.blobId }));
      if (!files.length || model.selection?.some(name => !files.some(f => f.filename === name))) throw new Error('Configured audio weights were not found.');
      for (const f of files) if (!Number.isSafeInteger(f.bytes) || f.bytes <= 0 || !(f.sha256 ? /^[0-9a-f]{64}$/.test(f.sha256) : /^[0-9a-f]{40}$/.test(f.gitOid || ''))) throw new Error('Audio publisher checksum metadata is incomplete.');
      const latest = { ...model, revision: meta.sha, files }; snapshotPath(root, latest); return latest;
    } catch (error) { log(model.name + ': update check unavailable (' + error.message + '); using installed or pinned revision.'); return previous.find(m => m.id === model.id) || model; }
  }));
  let missing = 0;
  for (const model of models) for (const file of model.files) {
    const path = snapshotFile(snapshotPath(root, model), file.filename);
    if (await stat(path).then(s => s.size).catch(() => 0) !== file.bytes) missing += file.bytes - Math.min(file.bytes, await stat(path + '.part').then(s => s.size).catch(() => 0));
  }
  const disk = await statfs(root, { bigint: true });
  if (disk.bavail * disk.bsize < BigInt(missing) + 4_000_000_000n) throw new Error('Free additional disk space for audio model downloads.');
  for (const model of models) {
    const folder = snapshotPath(root, model); await mkdir(folder, { recursive: true });
    const receiptPath = join(folder, '.verified.json');
    const receipts = JSON.parse(await readFile(receiptPath, 'utf8').catch(() => '{}'));
    for (const file of model.files) {
      const path = snapshotFile(folder, file.filename), before = await stat(path).catch(() => null);
      const digest = file.sha256 || file.gitOid;
      if (before?.size === file.bytes && receipts[file.filename]?.digest === digest && receipts[file.filename]?.mtimeMs === before.mtimeMs) continue;
      const url = 'https://huggingface.co/' + model.repo + '/resolve/' + model.revision + '/' + file.filename.split('/').map(encodeURIComponent).join('/');
      if (file.sha256) {
        await download(url, path, file.sha256, file.bytes, model.name + ' / ' + file.filename);
        if (await hashFile(path) !== file.sha256) throw new Error('Audio model checksum mismatch: ' + file.filename);
      } else {
        const response = await fetchImpl(url, { signal: AbortSignal.timeout(60000) }); if (!response.ok) throw new Error('Audio config download failed: HTTP ' + response.status);
        const bytes = Buffer.from(await response.arrayBuffer());
        const oid = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
        if (bytes.length !== file.bytes || oid !== file.gitOid) throw new Error('Audio configuration checksum mismatch: ' + file.filename);
        await mkdir(dirname(path), { recursive: true }); await writeFile(path + '.part', bytes); await rename(path + '.part', path);
      }
      const after = await stat(path); receipts[file.filename] = { digest, mtimeMs: after.mtimeMs };
      await writeFile(receiptPath, JSON.stringify(receipts));
    }
    log(model.name + ': verified and ready.');
  }
  const temp = join(root, 'models/audio-' + randomUUID() + '.tmp');
  await writeFile(temp, JSON.stringify({ checkedAt: new Date().toISOString(), models: [...previous.filter(m => !models.some(c => c.id === m.id)), ...models] }, null, 2));
  await rename(temp, join(root, 'models/audio-installed.json'));
  return models;
}
