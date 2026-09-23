import { huggingFaceHeaders } from './huggingface-auth.mjs';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, stat, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
function progress(value) { if (process.send) process.send({ type: 'download', ...value }); }
export async function download(url, destination, expectedHash, expectedBytes, label) {
  if (existsSync(destination) && (!expectedBytes || (await stat(destination)).size === expectedBytes)) return destination;
  await mkdir(dirname(destination), { recursive: true });
  const partial = destination + '.part';
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      let offset = await stat(partial).then(s => s.size).catch(() => 0);
      if (expectedBytes && offset === expectedBytes) {
        if (await hashFile(partial) === expectedHash) { await rename(partial, destination); return destination; }
        await rm(partial); offset = 0;
      }
      progress({ label, loaded: offset, total: expectedBytes, phase: 'downloading' });
      console.log('Downloading ' + label + (expectedBytes ? ' (' + (expectedBytes / 1e9).toFixed(2) + ' GB)' : '') + '…');
      const response = await fetch(url, { headers: { ...(await huggingFaceHeaders(url)), ...(offset ? { Range: 'bytes=' + offset + '-' } : {}) }, signal: AbortSignal.timeout(12 * 60 * 60 * 1000) });
      if (!response.ok) { const gated = [401,403].includes(response.status) && new URL(url).hostname === 'huggingface.co'; throw Object.assign(new Error(gated ? 'Hugging Face access is required. Grant access on the model publisher page, then sign in with hf auth login or set HF_TOKEN before starting Wizgard.' : 'HTTP ' + response.status), { permanent:gated }); }
      const append = offset > 0 && response.status === 206;
      if (append && !response.headers.get('content-range')?.startsWith('bytes ' + offset + '-')) throw new Error('Invalid download resume response.');
      if (!append) offset = 0;
      let loaded = offset, printed = Date.now();
      const stream = Readable.fromWeb(response.body);
      stream.on('data', chunk => {
        loaded += chunk.length;
        if (Date.now() - printed > 500) { progress({ label, loaded, total: expectedBytes, phase: 'downloading' }); console.log('  ' + label + ': ' + (loaded / 1e9).toFixed(2) + (expectedBytes ? ' / ' + (expectedBytes / 1e9).toFixed(2) : '') + ' GB'); printed = Date.now(); }
      });
      await pipeline(stream, createWriteStream(partial, { flags: append ? 'a' : 'w' }));
      if (expectedBytes && (await stat(partial)).size !== expectedBytes) throw new Error('Incomplete download.');
      progress({ label, loaded: expectedBytes, total: expectedBytes, phase: 'verifying' });
      console.log('Verifying ' + label + '…');
      if (await hashFile(partial) !== expectedHash) { await rm(partial); throw new Error('SHA-256 verification failed.'); }
      await rename(partial, destination);
      return destination;
    } catch (error) {
      lastError = error;
      if (error.permanent) break;
      if (attempt < 4) { console.log('Download interrupted; resuming (attempt ' + (attempt + 1) + '/4)…'); await new Promise(r => setTimeout(r, 1500)); }
    }
  }
  throw new Error('Could not download ' + label + ': ' + lastError.message + '. Check the connection and free disk space, then run again to resume.');
}
