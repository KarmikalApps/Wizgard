import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {unpack,run} from './setup.mjs';
import {findExecutable} from '../server/platform.mjs';
export function llamaExecutable(root){const base=join(root,'runtime','llama-'+process.platform+'-'+process.arch);return findExecutable(join(base,'cuda'),process.platform==='win32'?'llama-server.exe':'llama-server')||findExecutable(join(base,'cpu'),process.platform==='win32'?'llama-server.exe':'llama-server');}
export async function setupLlama(root){
 const entries=JSON.parse(await readFile(join(root,'llama-runtime-manifest.json'),'utf8')).filter(e=>e.platform===process.platform+'-'+process.arch);
 if(!entries.length)throw new Error('No bundled llama.cpp runtime for this platform.');
 const cuda=entries.some(e=>e.backend==='cuda')&&spawnSync(process.platform==='win32'?'nvidia-smi.exe':'nvidia-smi',['-L'],{stdio:'ignore',windowsHide:true}).status===0;
 for(const e of entries.filter(e=>e.backend===(cuda?'cuda':'cpu')))await unpack(root,e);
 const exe=llamaExecutable(root);if(!exe)throw new Error('llama-server was not found after extraction.');await run(exe,['--version'],{stdio:'ignore'});
}
