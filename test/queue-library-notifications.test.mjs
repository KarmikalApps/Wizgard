import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {setImmediate as tick} from 'node:timers/promises';
import {JobQueue} from '../server/jobs.mjs';
import {GeneratedLibrary} from '../server/library.mjs';
import {generationRecord} from '../server/generation-record.mjs';
import {normalizeNotifications,notificationEligible,claimNotification} from '../src/notification-policy.mjs';
test('waiting jobs reorder without interrupting the running job; stale orders fail',async t=>{
 const started=[],release=new Map(),q=new JobQueue({maxChats:1,run:j=>{started.push(j.id);return new Promise(r=>release.set(j.id,r));},pause:async()=>{},resume:async()=>{}});
 t.after(()=>{for(const done of release.values())done();for(const j of q.jobs.values())clearTimeout(j.expiry);});
 const add=()=>{const j=q.create({mode:'chat',prompt:'test',settings:{}},{id:randomUUID(),title:'test'});q.ready(j);return j;};
 const a=add(),b=add(),c=add();q.reorder([c.id,b.id]);assert.deepEqual(q.snapshot().map(j=>j.id),[a.id,c.id,b.id]);assert.deepEqual(started,[a.id]);
 assert.throws(()=>q.reorder([c.id,c.id]),/queue changed/);assert.throws(()=>q.reorder([a.id,b.id]),/queue changed/);
 release.get(a.id)();await tick();assert.deepEqual(started,[a.id,c.id]);release.get(c.id)();await tick();assert.equal(b.state,'running');release.get(b.id)();await tick();
});
test('timing estimates learn completed work and exclude pauses and waiting',async t=>{
 let complete;const q=new JobQueue({maxChats:1,run:()=>new Promise(r=>complete=r),pause:async()=>{},resume:async()=>{}});
 t.after(()=>{complete?.();for(const j of q.jobs.values())clearTimeout(j.expiry);});
 const a=q.create({mode:'image',settings:{width:512}},{id:randomUUID()});q.ready(a);a.activeSince=Date.now()-10000;
 await q.control(a.id,'pause');const paused=q.activeSeconds(a);a.createdAt=new Date(Date.now()-60000).toISOString();assert.equal(q.activeSeconds(a),paused);
 await q.control(a.id,'resume');complete();await tick();assert.ok(q.estimate(a)>=10);assert.equal(q.completedSnapshot()[0].state,'complete');
 const b=q.create({mode:'image',settings:{width:512}},{id:randomUUID()});q.ready(b);const c=q.create({mode:'image',settings:{width:512}},{id:randomUUID()});q.ready(c);
 assert.ok(q.snapshot().find(j=>j.id===c.id).waitSeconds>=9);assert.equal(q.snapshot()[0].estimateSource,'recent similar jobs');await q.control(b.id,'stop');await q.control(c.id,'stop');complete();await tick();
});
test('library search filters before pagination and favorites persist independently of filters',async t=>{
 const root=await mkdtemp(join(tmpdir(),'wizgard-library-search-'));t.after(()=>rm(root,{recursive:true,force:true}));const lib=new GeneratedLibrary(root);await lib.init();await mkdir(join(root,'data/images'),{recursive:true});
 for(let n=0;n<25;n++){const name=randomUUID()+'.png';await writeFile(join(root,'data/images',name),'image');await lib.register({imageUrl:'/generated/'+name,imagePrompt:'Moon garden '+n,model:n%2?'Qwen':'FLUX',createdAt:'2026-09-23T12:00:00.000Z',seed:n,width:512,height:512,steps:8},{mode:'image',prompt:'Moon garden',settings:{imageModel:'flux2',seed:-1,width:512,height:512,steps:8},attachmentIds:[]});}
 assert.equal(lib.list('image',1,{q:'moon'}).total,25);assert.equal(lib.list('image',2,{q:'MOON'}).items.length,5);
 const first=lib.items[0];await lib.favorite(first.id,true);assert.equal(lib.list('all',1,{favorite:true}).total,1);assert.equal(lib.list('all',1,{q:'missing'}).total,0);assert.equal(lib.list('all',1,{model:'FLUX'}).total,13);assert.equal(lib.list('all',1,{from:'2026-09-24'}).total,0);
 assert.throws(()=>lib.list('all',1,{from:'2026-02-30'}),/valid date/);const reload=new GeneratedLibrary(root);await reload.init();assert.equal(reload.list('all',1,{favorite:true}).items[0].id,first.id);
 assert.equal(first.generation.settings.seed,24);assert.equal(first.generation.request.settings.seed,-1);
});
test('generation details keep effective audio settings and distinguish incomplete older records',()=>{
 const input={mode:'music',prompt:'song',settings:{seed:-1,musicSeconds:120},attachmentIds:['reference']};
 const record=generationRecord({audioKind:'music',seed:55,seconds:30},input,{seconds:30,lyrics:'hello',seed:-1});assert.equal(record.settings.musicSeconds,30);assert.equal(record.settings.seed,55);assert.deepEqual(record.request,input);
 assert.equal(generationRecord({imageUrl:'/generated/test.png',seed:42,model:'FLUX.2-dev'}).source,'partial');
});
test('notifications default off, ignore stopped and old jobs, and honor error preference',()=>{
 const job={state:'complete',finishedAt:new Date(2000).toISOString()},prefs=normalizeNotifications({});assert.equal(prefs.enabled,false);assert.equal(notificationEligible(job,prefs,0),false);
 const enabled=normalizeNotifications({enabled:true,enabledAt:1000});assert.equal(notificationEligible(job,enabled,0),true);assert.equal(notificationEligible(job,enabled,3000),false);assert.equal(notificationEligible({...job,state:'stopped'},enabled,0),false);assert.equal(notificationEligible({...job,state:'error'},{...enabled,errors:false},0),false);
});

test('notification receipts prevent duplicate delivery and tolerate damaged saved data',()=>{
 let saved='null';const storage={getItem:()=>saved,setItem:(_,value)=>saved=value};
 assert.equal(claimNotification(storage,'job-a'),true);assert.equal(claimNotification(storage,'job-a'),false);assert.equal(claimNotification(storage,'job-b'),true);
 saved='{broken';assert.equal(claimNotification(storage,'job-c'),true);assert.equal(normalizeNotifications(null).enabled,false);
});
