import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { download } from '../scripts/download.mjs';

test('model installer resumes partial downloads, verifies content, and reuses installed files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wizgard-download-test-'));
  const payload = Buffer.from('A complete model fixture, including its final bytes.');
  const sha = createHash('sha256').update(payload).digest('hex');
  let requests = 0;
  const server = http.createServer((req, res) => {
    requests++; assert.equal(req.headers.range, 'bytes=12-');
    res.writeHead(206, { 'Content-Range': 'bytes 12-' + (payload.length - 1) + '/' + payload.length }); res.end(payload.subarray(12));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const path = join(root, 'model.gguf'); await writeFile(path + '.part', payload.subarray(0, 12));
    const url = 'http://127.0.0.1:' + server.address().port;
    await download(url, path, sha, payload.length, 'test model');
    assert.deepEqual(await readFile(path), payload);
    await download(url, path, sha, payload.length, 'test model');
    assert.equal(requests, 1);
  } finally { await new Promise(r => server.close(r)); await rm(root, { recursive: true, force: true }); }
});
