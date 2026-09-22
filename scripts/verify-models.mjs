import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashFile } from './download.mjs';
import { installedModels } from './models.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const models = await installedModels(root);
for (const model of models) {
  console.log('Checking ' + model.name + '…');
  try { if (await hashFile(join(root, model.path)) !== model.sha256) throw new Error('SHA-256 mismatch'); console.log('OK'); }
  catch (error) { console.error('FAILED: ' + model.path + ': ' + error.message); process.exitCode = 1; }
}
