import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,unlink,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setImmediate as tick} from 'node:timers/promises';
import {JobQueue} from '../server/jobs.mjs';
import {GeneratedLibrary} from '../server/library.mjs';
import {buildImageArgs} from '../server/image-models.mjs';
import {switchImageSettings} from '../src/image-options.mjs';
import {validateRequest} from '../server/policy.mjs';

function harness(t,run){
 const started=[],releases=new Map();let frozen=false;
 const queue=new JobQueue({run:run||((job)=>{started.push(job);return new Promise(resolve=>releases.set(job.id,resolve));}),pause:async()=>{frozen=true;},resume:async()=>{frozen=false;}});
 t.after(()=>{for(const release of releases.values())release();for(const job of queue.jobs.values())clearTimeout(job.expiry);});
 const add=(mode='chat',ready=true)=>{const job=queue.create({mode},{id:randomUUID(),messages:[]});if(ready)queue.ready(job);return job;};
 return {queue,add,started,releases,isFrozen:()=>frozen};
}
test('two conversations run concurrently; media waits and owns the engine exclusively',async t=>{
 const {queue,add,started,releases}=harness(t);
 const a=add(),b=add(),media=add('image'),c=add();
 assert.deepEqual(started,[a,b]);assert.throws(()=>queue.create({mode:'chat'},a.conversation),/unfinished/);
 releases.get(a.id)();await tick();assert.deepEqual(started,[a,b]);
 releases.get(b.id)();await tick();assert.deepEqual(started,[a,b,media]);assert.equal(c.state,'queued');
 releases.get(media.id)();await tick();assert.equal(c.state,'running');releases.get(c.id)();await tick();assert.equal(queue.busy,false);
});
test('jobs cannot run before their conversation is persisted',async t=>{
 const {queue,add,started,releases}=harness(t);const unready=add('chat',false),ready=add();
 assert.deepEqual(started,[ready]);queue.ready(unready);assert.deepEqual(started,[ready,unready]);
 releases.get(ready.id)();releases.get(unready.id)();await tick();
});
test('pausing retains running work and marks the shared engine; queued work can pause too',async t=>{
 const {queue,add,releases,isFrozen}=harness(t);const a=add(),b=add(),c=add();
 await queue.control(c.id,'pause');assert.equal(c.executing,undefined);
 await queue.control(a.id,'pause');assert.equal(isFrozen(),true);assert.equal(a.executing,true);assert.equal(queue.snapshot().find(j=>j.id===b.id).sharedPause,true);
 releases.get(b.id)();await tick();assert.equal(c.state,'paused');
 await queue.control(a.id,'resume');assert.equal(isFrozen(),false);await queue.control(c.id,'resume');assert.equal(c.state,'running');
 releases.get(a.id)();releases.get(c.id)();await tick();
});
test('auto requests release their chat slot before exclusive generation and stop cleanly while waiting',async t=>{
 let continueAuto;const started=[],finished=[];
 const q=new JobQueue({pause:async()=>{},resume:async()=>{},run:async j=>{
  started.push(j.id);if(j.input.mode==='auto'){await new Promise(r=>continueAuto=r);await q.exclusive(j);finished.push(j.id);}else await new Promise(r=>j.release=r);
 }});
 t.after(()=>{for(const j of q.jobs.values()){j.release?.();clearTimeout(j.expiry);}});
 const a=q.create({mode:'auto'},{id:randomUUID()}),b=q.create({mode:'chat'},{id:randomUUID()});q.ready(a);q.ready(b);continueAuto();await tick();
 assert.equal(a.state,'queued');assert.equal(a.executing,false);assert.equal(finished.length,0);
 await q.control(a.id,'stop');await tick();assert.equal(a.state,'stopped');assert.equal(a.events.filter(e=>e.event==='end').length,1);assert.equal(finished.length,0);
 b.release();await tick();assert.equal(q.busy,false);
});
test('stopping queued work cleans up without starting it; shutdown never starts another job',async t=>{
 const {queue,add,started,releases}=harness(t);const a=add('image'),b=add(),c=add();
 await queue.control(b.id,'stop');assert.equal(b.state,'stopped');assert.ok(b.expiry);assert.equal(started.length,1);
 await queue.stopAll();releases.get(a.id)();await tick();assert.equal(c.state,'stopped');assert.equal(started.length,1);
});
test('library category removal spans pages, removes missing entries, and preserves other categories and user files',async t=>{
 const root=await mkdtemp(join(tmpdir(),'wizgard-library-delete-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const lib=new GeneratedLibrary(root);await lib.init();const ids=[];
 for(let i=0;i<23;i++){
  const name=randomUUID()+'.mp4';await mkdir(join(root,'data/videos'),{recursive:true});await writeFile(join(root,'data/videos',name),'video');
  const item=await lib.register({videoUrl:'/generated-videos/'+name,videoPrompt:'test'});ids.push(item.id);
 }
 const name=randomUUID()+'.png';await mkdir(join(root,'data/images'),{recursive:true});await writeFile(join(root,'data/images',name),'image');const picture=await lib.register({imageUrl:'/generated/'+name,imagePrompt:'keep'});
 const keep=join(root,'data/outputs/Wizgard/videos/keep.txt');await writeFile(keep,'user file');
 const first=(await lib.file(ids[0])).path;await unlink(first);assert.equal(await lib.pruneMissing(),1);
 const missing=(await lib.file(ids[1])).path;await unlink(missing);assert.deepEqual(await lib.remove({id:ids[1]}),{removed:1,failed:0});
 const one=(await lib.file(ids[2])).path;assert.deepEqual(await lib.remove({id:ids[2]}),{removed:1,failed:0});await assert.rejects(stat(one),{code:'ENOENT'});
 assert.equal(lib.list('video').total,20);assert.deepEqual(await lib.remove({category:'video'}),{removed:20,failed:0});
 assert.equal(lib.list().total,1);assert.equal(await readFile(keep,'utf8'),'user file');assert.equal(await readFile(picture.path,'utf8'),'image');
 const reload=new GeneratedLibrary(root);await reload.init();assert.equal(reload.list().total,1);
 await reload.remove({category:'all'});await assert.rejects(stat(picture.path),{code:'ENOENT'});assert.equal(await readFile(keep,'utf8'),'user file');
});
test('FLUX references use Mistral without a vision projector; image settings stay separate',()=>{
 const settings={width:512,height:512,steps:28,seed:123,imageGuidance:4};const files={diffusion:'diffusion',encoder:'encoder',vae:'vae'};
 const args=buildImageArgs({modelId:'flux2',files,prompt:'test',settings,destination:'out.png',referencePaths:['one.png','two.png']});
 assert.equal(args.includes('--llm_vision'),false);assert.deepEqual(args.slice(-4),['-r','one.png','-r','two.png']);assert.ok(args.includes('--guidance'));
 assert.throws(()=>buildImageArgs({modelId:'qwen',files,prompt:'test',settings,destination:'out.png',referencePaths:['one.png']}),/vision component/);
 const a={...settings,imageModel:'qwen',steps:25},b=switchImageSettings(a,'flux2');assert.equal(b.steps,28);assert.equal(switchImageSettings({...b,steps:33},'qwen').steps,25);
 assert.throws(()=>validateRequest({prompt:'test',mode:'image',settings:{imageModel:'unknown'}}));
});
