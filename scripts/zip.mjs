import { open, mkdir, chmod, symlink } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { createInflateRaw, inflateRawSync } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

// Extract verified vendor ZIPs using Node alone; no system unzip is required.
export async function extractZip(archive, destination, strip = 0) {
  const file = await open(archive, 'r');
  try {
    const size = (await file.stat()).size;
    const tail = Buffer.alloc(Math.min(size, 65557));
    await file.read(tail, 0, tail.length, size - tail.length);
    let end = tail.length - 22;
    while (end >= 0 && tail.readUInt32LE(end) !== 0x06054b50) end--;
    if (end < 0) throw new Error('Invalid ZIP directory.');
    const count = tail.readUInt16LE(end + 10), offset = tail.readUInt32LE(end + 16), bytes = tail.readUInt32LE(end + 12);
    if (count === 65535 || offset === 0xffffffff) throw new Error('ZIP64 is not supported for this runtime archive.');
    const central = Buffer.alloc(bytes); await file.read(central, 0, bytes, offset);
    let cursor = 0;
    const root = resolve(destination);
    for (let i = 0; i < count; i++) {
      if (central.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Invalid ZIP member.');
      const flags = central.readUInt16LE(cursor + 8), method = central.readUInt16LE(cursor + 10);
      const compressed = central.readUInt32LE(cursor + 20), nameLen = central.readUInt16LE(cursor + 28), extraLen = central.readUInt16LE(cursor + 30), commentLen = central.readUInt16LE(cursor + 32);
      const mode = central.readUInt32LE(cursor + 38) >>> 16, localOffset = central.readUInt32LE(cursor + 42);
      const original = central.subarray(cursor + 46, cursor + 46 + nameLen).toString('utf8');
      cursor += 46 + nameLen + extraLen + commentLen;
      const parts = original.replaceAll('\\', '/').split('/');
      if (original.startsWith('/') || parts.includes('..') || parts.some(p => p.includes(':'))) throw new Error('Unsafe archive member.');
      const name = parts.slice(strip).join('/'); if (!name) continue;
      const target = resolve(root, name);
      if (!target.startsWith(root + sep)) throw new Error('Archive member escapes its destination.');
      if (name.endsWith('/')) { await mkdir(target, { recursive: true }); continue; }
      if (flags & 1 || ![0, 8].includes(method)) throw new Error('Unsupported ZIP compression.');
      await mkdir(dirname(target), { recursive: true });
      const local = Buffer.alloc(30); await file.read(local, 0, 30, localOffset);
      const start = localOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28);
      if ((mode & 0o170000) === 0o120000) {
        const data = Buffer.alloc(compressed); await file.read(data, 0, compressed, start);
        const link = (method === 8 ? inflateRawSync(data) : data).toString();
        const resolved = resolve(dirname(target), link);
        if (!resolved.startsWith(root + sep)) throw new Error('Archive symlink escapes its destination.');
        await symlink(link, target);
      } else {
        if (compressed === 0) { const empty = await open(target, 'w'); await empty.close(); }
        else {
          const input = createReadStream(archive, { start, end: start + compressed - 1 });
          await pipeline(...(method === 8 ? [input, createInflateRaw(), createWriteStream(target)] : [input, createWriteStream(target)]));
        }
        if (process.platform !== 'win32') await chmod(target, (mode & 0o777) || 0o755);
      }
    }
  } finally { await file.close(); }
}
