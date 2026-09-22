import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setupEngines, run } from './setup.mjs';
import { setupVideo, videoCatalog } from './setup-video.mjs';
import { setupAudio } from './setup-audio.mjs';
import { updateModels } from './models.mjs';
import { updateAudioModels } from './audio-models.mjs';
import { modelDefinitions } from '../server/model-manager.mjs';
import { execFile } from 'node:child_process';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const parent = Number(process.env.WIZGARD_PARENT_PID);
if(parent > 0) {
  const watch = setInterval(() => {
    try { process.kill(parent,0); }
    catch {
      if(process.platform === 'win32') execFile('taskkill.exe',['/PID',String(process.pid),'/T','/F'],{windowsHide:true},()=>process.exit(1));
      else { try { process.kill(-process.pid,'SIGTERM'); } catch { process.exit(1); } }
    }
  },1000);
  watch.unref();
}
try {
  for (const id of process.argv.slice(2)) {
    const def = modelDefinitions.find(m => m.id === id); if (!def) throw new Error('Unknown model.');
    process.send?.({ type:'model',id,phase:'runtime',message:'Preparing ' + def.name + ' engine…' });
    if (def.audio) await setupAudio(root,{ models:false,kinds:[id] });
    else if (id === 'video') await setupVideo(root,{ models:false });
    else await setupEngines(root,id);
    if(id === 'chat') { try { await run(process.execPath,[resolve(root,'node_modules/playwright/cli.js'),'install','chromium'],{cwd:root,env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:resolve(root,'runtime/browsers')}}); } catch(e) { console.warn('Browser unavailable; plain web pages can still be read. ' + e.message); } }
    process.send?.({ type:'model',id,phase:'weights',message:'Checking and downloading ' + def.name + '…' });
    if (def.audio) await updateAudioModels(root,{ ids:[id] });
    else await updateModels(root,{ catalogFile:def.catalog,stateFile:def.stateFile,ids:def.ids });
    process.send?.({ type:'complete',id });
  }
} catch(e) { console.error(e.stack || e.message); process.exitCode=1; }
finally { process.disconnect?.(); }
