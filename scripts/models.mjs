import { readFile, writeFile, mkdir, rename, stat, statfs } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { download, hashFile } from './download.mjs';

const digestPattern = /^[0-9a-f]{64}$/;
export function modelPath(model, sha256) {
  if (!digestPattern.test(sha256)) throw new Error('Invalid model checksum.');
  if (['chat', 'chat-projector'].includes(model.id)) return 'models/ollama/blobs/sha256-' + sha256;
  if (model.kind === 'video') return 'models/video/' + model.category + '/' + sha256 + '/' + model.filename.split('/').at(-1);
  return 'models/image/' + sha256 + '/' + model.filename.split('/').at(-1);
}
function safePath(root, relative) {
  const path = resolve(root, relative);
  if (!path.startsWith(resolve(root, 'models') + sep)) throw new Error('Model path is outside the models directory.');
  return path;
}
export async function publisherModel(model, fetchImpl = fetch) {
  const response = await fetchImpl('https://huggingface.co/api/models/' + model.repo + '/revision/main?blobs=true', { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('Publisher check returned HTTP ' + response.status);
  const info = await response.json();
  const file = info.siblings?.find(item => item.rfilename === model.filename);
  if (!file || !digestPattern.test(file.lfs?.sha256 || '') || !Number.isSafeInteger(file.size) || file.size <= 0 || !/^[0-9a-f]{40,64}$/.test(info.sha || '')) {
    throw new Error('Publisher metadata is missing the configured file or a valid checksum.');
  }
  return { ...model, bytes: file.size, sha256: file.lfs.sha256, revision: info.sha,
    url: 'https://huggingface.co/' + model.repo + '/resolve/' + info.sha + '/' + model.filename.split('/').map(encodeURIComponent).join('/') };
}
export async function installedModels(root, { catalogFile = 'model-manifest.json', stateFile = 'models/installed.json' } = {}) {
  try {
    const state = JSON.parse(await readFile(join(root, stateFile), 'utf8'));
    if (!Array.isArray(state.models)) throw new Error('Invalid installed model state.');
    for (const model of state.models) safePath(root, model.path);
    return state.models;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return JSON.parse(await readFile(join(root, catalogFile), 'utf8'));
  }
}
export async function updateModels(root, { fetchImpl = fetch, downloadImpl = download, log = console.log, catalogFile = 'model-manifest.json', stateFile = 'models/installed.json', ids } = {}) {
  const fullCatalog = JSON.parse(await readFile(join(root, catalogFile), 'utf8'));
  const catalog = ids ? fullCatalog.filter(m => ids.includes(m.id)) : fullCatalog;
  const previous = await installedModels(root, { catalogFile, stateFile });
  log('Checking publishers for model updates…');
  const checks = await Promise.all(catalog.map(async model => {
    try { return { latest: await publisherModel(model, fetchImpl), checked: true }; }
    catch (error) {
      log('Update check unavailable for ' + model.name + ': ' + error.message + ' Using the installed or pinned version; latest status is unknown.');
      return { latest: previous.find(item => item.id === model.id) || model, checked: false };
    }
  }));
  const chosen = checks.map(({ latest, checked }) => {
    const known = previous.find(item => item.id === latest.id && item.sha256 === latest.sha256);
    const baseline = catalog.find(item => item.id === latest.id && item.sha256 === latest.sha256);
    return { ...latest, path: known?.path || baseline?.path || modelPath(latest, latest.sha256), checked, receipt: known?.receipt };
  });
  let missing = 0;
  for (const model of chosen) {
    const file = safePath(root, model.path);
    const size = await stat(file).then(s => s.size).catch(() => 0);
    if (size !== model.bytes) missing += model.bytes - Math.min(model.bytes, await stat(file + '.part').then(s => s.size).catch(() => 0));
  }
  if (missing > 0) {
    const disk = await statfs(root, { bigint: true });
    if (disk.bavail * disk.bsize < BigInt(missing) + 6000000000n) throw new Error('Not enough free space for model updates. Keep old weights intact and free at least ' + ((missing + 6e9) / 1e9).toFixed(1) + ' GB, then retry.');
  }
  for (const model of chosen) {
    const file = safePath(root, model.path);
    const before = await stat(file).catch(() => null);
    const trusted = before?.size === model.bytes && model.receipt?.sha256 === model.sha256 && model.receipt?.mtimeMs === before.mtimeMs;
    if (!trusted) {
      await downloadImpl(model.url, file, model.sha256, model.bytes, model.name);
      log('Checking integrity: ' + model.name + '…');
      if (await hashFile(file) !== model.sha256) throw new Error('Model checksum mismatch: ' + model.name + '. The previously active model set was not changed.');
    }
    const after = await stat(file);
    model.receipt = { sha256: model.sha256, mtimeMs: after.mtimeMs, bytes: after.size };
    log(model.name + (model.checked ? ': up to date.' : ': available; update check could not be completed.'));
  }
  // Activate the complete set only after every required file verifies.
  const folder = join(root, 'models'); await mkdir(folder, { recursive: true });
  const temp = join(folder, 'installed-' + randomUUID() + '.tmp');
  await writeFile(temp, JSON.stringify({ checkedAt: new Date().toISOString(), models: [...previous.filter(m => !chosen.some(c => c.id === m.id)), ...chosen] }, null, 2));
  await rename(temp, join(root, stateFile));
  return chosen;
}
