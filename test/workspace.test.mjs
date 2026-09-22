import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { clearWorkspaceData } from '../server/workspace.mjs';

test('Clear Workspace removes all generated content but preserves models, settings, and unrelated logs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wizgard-clear-test-'));
  try {
    for (const folder of ['data/conversations', 'data/images', 'data/videos', 'data/attachments', 'data/video-temp', 'data/logs', 'models']) await mkdir(join(root, folder), { recursive: true });
    for (const file of ['data/conversations/a.json', 'data/images/image.png', 'data/videos/clip.mp4', 'data/attachments/private.pdf', 'data/video-temp/frame.png', 'data/logs/video-123abc.log', 'data/logs/image-123abc.log', 'data/settings.json', 'data/logs/server.log', 'models/test.gguf']) await writeFile(join(root, file), file);
    await clearWorkspaceData(join(root, 'data'));
    assert.deepEqual(await readdir(join(root, 'data/conversations')), []);
    assert.deepEqual(await readdir(join(root, 'data/images')), []);
    for (const folder of ['videos','attachments','video-temp']) assert.deepEqual(await readdir(join(root,'data',folder)),[]);
    assert.deepEqual(await readdir(join(root, 'data/logs')), ['server.log']);
    assert.equal(await readFile(join(root, 'models/test.gguf'), 'utf8'), 'models/test.gguf');
    assert.equal(await readFile(join(root, 'data/settings.json'), 'utf8'), 'data/settings.json');
    await clearWorkspaceData(join(root, 'data'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
