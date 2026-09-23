import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

// Reuse a local HF sign-in without copying credentials into the portable project.
export async function huggingFaceHeaders(url, env = process.env) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.hostname !== 'huggingface.co') return {};
  let token = env.HF_TOKEN || env.HUGGING_FACE_HUB_TOKEN;
  if (!token) {
    const home = env.HF_HOME || join(env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'huggingface');
    token = await readFile(env.HF_TOKEN_PATH || join(home, 'token'), 'utf8').catch(() => '');
  }
  return token?.trim() ? { Authorization: 'Bearer ' + token.trim() } : {};
}
