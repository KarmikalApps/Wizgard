import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { updateModels, installedModels } from '../scripts/models.mjs';
import { matchesModel } from '../server/model-selection.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
test('startup checks every time, activates verified changes, and preserves the active set on failure', async t => {
  const root = await mkdtemp(join(tmpdir(), 'wizgard-model-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const baseline = ['chat', 'diffusion'].map(id => ({ id, name: id, repo: 'publisher/' + id,
    filename: id + '.gguf', path: 'models/' + id + '.gguf', bytes: 3, sha256: sha('old'),
    revision: '1'.repeat(40), url: 'https://example.test/' + id }));
  await writeFile(join(root, 'model-manifest.json'), JSON.stringify(baseline));
  await mkdir(join(root, 'models'));
  for (const model of baseline) await writeFile(join(root, model.path), 'old');
  let contents = 'old', checks = 0, downloads = 0, offline = false, corrupt = false;
  const options = {
    log() {},
    async fetchImpl(url) {
      checks++;
      if (offline) throw new Error('offline');
      const model = baseline.find(m => url.includes('/' + m.repo + '/'));
      assert.ok(model);
      return { ok: true, async json() { return { sha: '2'.repeat(40), siblings: [
        { rfilename: model.filename, size: 3, lfs: { sha256: sha(contents) } }
      ] }; } };
    },
    async downloadImpl(url, path) {
      downloads++;
      assert.match(url, /\/resolve\/2{40}\//);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, corrupt ? 'bad' : contents);
    },
  };
  await updateModels(root, options);
  assert.equal(checks, 2);
  assert.equal(downloads, 2); // Initial integrity adoption.
  await updateModels(root, options);
  assert.equal(checks, 4); // A verified install still checks publishers on every launch.
  assert.equal(downloads, 2);
  contents = 'new'; // Same byte length, different content.
  const updated = await updateModels(root, options);
  assert.equal(downloads, 4);
  assert.equal(updated[0].path, 'models/ollama/blobs/sha256-' + sha('new'));
  assert.ok(updated[1].path.includes(sha('new')));
  assert.equal(await readFile(join(root, baseline[0].path), 'utf8'), 'old');
  assert.equal((await installedModels(root))[0].sha256, sha('new'));
  const state = await readFile(join(root, 'models/installed.json'), 'utf8');
  contents = 'end'; corrupt = true;
  await assert.rejects(updateModels(root, options), /checksum mismatch/);
  assert.equal(await readFile(join(root, 'models/installed.json'), 'utf8'), state);
  offline = true;
  const kept = await updateModels(root, options);
  assert.equal(kept[0].sha256, sha('new'));
  assert.equal(kept[0].checked, false);
});

test('Ollama must have the current source blob, not merely an existing alias', () => {
  const current = sha('new'), old = sha('old');
  assert.equal(matchesModel({ modelfile: 'FROM "C:/models/sha256-' + current + '"\nPARAMETER temperature 0.7' }, current), true);
  assert.equal(matchesModel({ modelfile: 'FROM /models/sha256-' + old }, current), false);
  assert.equal(matchesModel({ modelfile: '# sha256-' + current + '\nFROM old.gguf' }, current), false);
  assert.equal(matchesModel({}, current), false);
});
