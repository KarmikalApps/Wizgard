import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function findExecutable(folder, name) {
  if (!existsSync(folder)) return null;
  for (const item of readdirSync(folder, { withFileTypes: true })) {
    const file = join(folder, item.name);
    if (item.isFile() && item.name.toLowerCase() === name) return file;
    if (item.isDirectory()) { const found = findExecutable(file, name); if (found) return found; }
  }
  return null;
}
export function platformPaths(root, platform = process.platform, arch = process.arch) {
  const windows = platform === 'win32';
  const base = join(root, 'runtime', windows ? '' : platform === 'darwin' ? 'darwin' : platform + '-' + arch);
  const ollamaFolder = join(base, 'ollama');
  const nativeBuild = join(root, 'runtime', platform + '-' + arch, 'sd-native');
  const sdName = windows ? 'sd-cli.exe' : 'sd-cli';
  const engines = {
    cuda: findExecutable(join(base, 'sd-cuda'), sdName),
    cpu: findExecutable(join(base, 'sd-cpu'), sdName),
    vulkan: findExecutable(join(base, 'sd-vulkan'), sdName),
    metal: findExecutable(join(base, 'sd-metal'), sdName),
  };
  const compiled = findExecutable(nativeBuild, sdName);
  if (compiled) engines[platform === 'darwin' && arch === 'arm64' ? 'metal' : 'cpu'] = compiled;
  // The upstream universal macOS binary includes GGML's Metal backend.
  if (platform === 'darwin' && arch === 'arm64' && engines.cpu) engines.metal = engines.cpu;
  return { base, ollamaFolder, ollamaExe: findExecutable(ollamaFolder, windows ? 'ollama.exe' : 'ollama'), engines };
}
