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
      console.log('Downloading ' + label + (expectedBytes ? ' (' + (expectedBytes / 1e9).toFixed(2) + ' GB)' : '') + '…');
      const response = await fetch(url, { headers: offset ? { Range: 'bytes=' + offset + '-' } : {}, signal: AbortSignal.timeout(12 * 60 * 60 * 1000) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const append = offset > 0 && response.status === 206;
      if (append && !response.headers.get('content-range')?.startsWith('bytes ' + offset + '-')) throw new Error('Invalid download resume response.');
      if (!append) offset = 0;
      let loaded = offset, printed = Date.now();
      const stream = Readable.fromWeb(response.body);
      stream.on('data', chunk => {
        loaded += chunk.length;
        if (Date.now() - printed > 5000) { console.log('  ' + label + ': ' + (loaded / 1e9).toFixed(2) + (expectedBytes ? ' / ' + (expectedBytes / 1e9).toFixed(2) : '') + ' GB'); printed = Date.now(); }
      });
      await pipeline(stream, createWriteStream(partial, { flags: append ? 'a' : 'w' }));
      if (expectedBytes && (await stat(partial)).size !== expectedBytes) throw new Error('Incomplete download.');
      console.log('Verifying ' + label + '…');
      if (await hashFile(partial) !== expectedHash) { await rm(partial); throw new Error('SHA-256 verification failed.'); }
      await rename(partial, destination);
      return destination;
    } catch (error) {
      lastError = error;
      if (attempt < 4) { console.log('Download interrupted; resuming (attempt ' + (attempt + 1) + '/4)…'); await new Promise(r => setTimeout(r, 1500)); }
    }
  }
  throw new Error('Could not download ' + label + ': ' + lastError.message + '. Check the connection and free disk space, then run again to resume.');
}
