import { readdir, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// The caller owns the generation lock and has validated explicit confirmation.
// Deliberately accept the data directory, never a client-provided path.
export async function clearWorkspaceData(data) {
  for (const name of ['conversations', 'images', 'videos', 'attachments', 'video-input', 'video-temp', 'video-runtime', 'audio', 'audio-jobs', 'music-runtime', 'music-temp', 'music-input']) {
    const folder = join(data, name);
    await mkdir(folder, { recursive: true });
    for (const entry of await readdir(folder, { withFileTypes: true })) {
      await rm(join(folder, entry.name), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }
  // Image engine logs may contain image prompts; clear those as well.
  const logs = join(data, 'logs');
  for (const name of await readdir(logs).catch(() => [])) {
    if (/^(?:image|video|audio)-[0-9a-f-]+\.log$/.test(name)) await rm(join(logs, name), { force: true });
  }
}
