import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashFile } from './download.mjs';
import { ModelManager,modelDefinitions } from '../server/model-manager.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manager=new ModelManager(root);await manager.init();
for(const item of manager.items){
  if(!item.weights){console.log(item.name+': not fully installed; skipped.');continue;}
  for(const file of await manager.filesFor(modelDefinitions.find(d=>d.id===item.id))){
    console.log('Checking '+item.name+' / '+file.filename+'…');
    try{
      let digest;
      if(file.sha256)digest=await hashFile(file.path);
      else{const hash=createHash('sha1').update('blob '+file.bytes+'\0');for await(const chunk of createReadStream(file.path))hash.update(chunk);digest=hash.digest('hex');}
      if(digest!==(file.sha256||file.gitOid))throw new Error('Checksum mismatch');console.log('OK');
    }catch(error){console.error('FAILED: '+file.filename+': '+error.message);process.exitCode=1;}
  }
}
