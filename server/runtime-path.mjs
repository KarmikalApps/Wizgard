import { createReadStream } from 'node:fs';
import { cp, mkdir, readFile, stat, rename, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash, randomUUID } from 'node:crypto';

export async function prepareOllamaPath(folder, original) {
  if (!original) throw new Error('Bundled Ollama is missing. Start Wizgard with the Run script for your operating system.');
  if (!folder.includes('[')) return { exe: original };
  const executable = relative(folder, original);

  // Ollama 0.34 treats square brackets in its library path as glob syntax.
  // Execute a disposable copy in Windows' normal temporary directory. All
  // bundled dependencies and model files remain in the portable project.
  const cacheRoot = join(tmpdir(), 'Wizgard', 'runtime');
  if (cacheRoot.includes('[')) throw new Error('The temporary folder also contains square brackets. Set TEMP (Windows) or TMPDIR (macOS/Linux) to a normal writable folder, then restart Wizgard.');
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(original)) hash.update(chunk);
  const fingerprint = hash.digest('hex');
  const cache = join(cacheRoot, 'ollama-' + fingerprint.slice(0, 16));
  try {
    if ((await readFile(join(cache, '.ready'), 'utf8')) === fingerprint && (await stat(join(cache, executable))).isFile()) {
      return { exe: join(cache, executable) };
    }
  } catch {}
  await mkdir(cacheRoot, { recursive: true });
  const staging = join(cacheRoot, 'copy-' + randomUUID());
  await cp(folder, staging, { recursive: true, force: false, errorOnExist: true });
  await writeFile(join(staging, '.ready'), fingerprint);
  await rename(staging, cache);
  return { exe: join(cache, executable) };
}
