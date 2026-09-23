import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,rm,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,dirname } from 'node:path';
import { randomUUID,createHash } from 'node:crypto';
import { routeFallback,validateRequest } from '../server/policy.mjs';
import { audioBrief } from '../server/audio-policy.mjs';
import { GeneratedLibrary } from '../server/library.mjs';
import { ModelManager } from '../server/model-manager.mjs';
import { updateModels,installedModels } from '../scripts/models.mjs';
import { snapshotFile,snapshotPath } from '../scripts/audio-models.mjs';
const fixture=async t=>{const root=await mkdtemp(join(tmpdir(),'wizgard-feature-test-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;};
test('audio routing distinguishes output requests, lyrics, questions and video with sound',()=>{
 for(const [prompt,route] of [['Say "Welcome home" in a calm voice','speech'],['Read this aloud: hello','speech'],['Create a song about spring','music'],['Generate rain sound effects','sfx'],['Create a video with music','video'],['Write lyrics for a song','chat'],['How can I generate speech?','chat'],['Do not generate music','chat']])assert.equal(routeFallback(prompt),route,prompt);
 const input=validateRequest({prompt:'Create 500 seconds of sound effects',mode:'sfx'});
 assert.equal(audioBrief('sfx',input.prompt,input.settings).seconds,30);
 assert.equal(audioBrief('speech','Say "hello world"',input.settings).text,'hello world');
 assert.throws(()=>validateRequest({prompt:'sound',mode:'sfx',settings:{sfxSeconds:31}}));
 assert.throws(()=>validateRequest({prompt:'say hi',mode:'speech',settings:{voice:'../../bad'}}));
 assert.throws(()=>snapshotFile('/models/speech','../secret'));
 assert.throws(()=>snapshotPath('/models',{id:'../bad',revision:'1'.repeat(40)}));
});
test('library paginates at twenty, keeps custom-location media, and clears only its own files',async t=>{
 const root=await fixture(t),library=new GeneratedLibrary(root);await library.init();
 const custom=join(root,'user-files');await library.configure(custom);await writeFile(join(custom,'keep.txt'),'personal');
 const messages=[];
 for(let i=0;i<23;i++){
  const name=randomUUID()+'.wav';await mkdir(join(root,'data/audio'),{recursive:true});await writeFile(join(root,'data/audio',name),'sample');
  const message={audioUrl:'/generated-audio/'+name,audioPrompt:'test '+i,audioKind:'speech'};await library.register(message);messages.push(message);
 }
 assert.equal(library.list('audio',1).items.length,20);assert.equal(library.list('audio',2).items.length,3);assert.equal(library.list('image',1).items.length,0);
 const first=await library.file(messages[0].libraryId);assert.ok(first.path.startsWith(custom));
 await library.configure('');assert.equal((await library.file(messages[0].libraryId)).path,first.path);
 assert.throws(()=>library.list('private',1));await assert.rejects(library.configure('../relative'));
 const reload=new GeneratedLibrary(root);await reload.init();assert.equal(reload.list().total,23);
 await reload.clear();assert.equal(await readFile(join(custom,'keep.txt'),'utf8'),'personal');await assert.rejects(stat(first.path),{code:'ENOENT'});
});
test('selective model updates leave unselected weights and state intact',async t=>{
 const root=await fixture(t),sha=x=>createHash('sha256').update(x).digest('hex');
 const models=['chat','diffusion'].map(id=>({id,name:id,repo:'test/'+id,filename:id+'.gguf',path:'models/'+id+'.gguf',bytes:3,sha256:sha('old'),revision:'1'.repeat(40),url:'https://example.invalid/'+id}));
 await mkdir(join(root,'models'));await writeFile(join(root,'model-manifest.json'),JSON.stringify(models));for(const m of models)await writeFile(join(root,m.path),'old');
 let checks=0;await updateModels(root,{ids:['chat'],log(){},fetchImpl:async()=>{checks++;return{ok:true,json:async()=>({sha:'2'.repeat(40),siblings:[{rfilename:'chat.gguf',size:3,lfs:{sha256:sha('new')}}]})};},downloadImpl:async(_,path)=>{await mkdir(dirname(path),{recursive:true});await writeFile(path,'new');}});
 assert.equal(checks,1);assert.equal((await installedModels(root)).find(m=>m.id==='diffusion').sha256,sha('old'));assert.equal(await readFile(join(root,'models/diffusion.gguf'),'utf8'),'old');
});
test('model manager supports zero-model setup, activation and confirmed uninstall without touching generated files',async t=>{
 const root=await fixture(t);await writeFile(join(root,'model-manifest.json'),JSON.stringify(['chat','chat-projector'].map(id=>({id,filename:id+'.gguf',path:'models/'+id+'.gguf',bytes:3,repo:'test/chat'}))));await writeFile(join(root,'video-model-manifest.json'),'[]');await writeFile(join(root,'audio-model-manifest.json'),JSON.stringify(['speech','music','sfx'].map(id=>({id,revision:'1'.repeat(40),files:[],repo:'test/'+id}))));
 await writeFile(join(root,'sulphur-model-manifest.json'),'[]');const manager=new ModelManager(root);await writeFile(join(root,'flux2-model-manifest.json'),'[]');await manager.init();assert.equal(manager.snapshot().setupRequired,true);await assert.rejects(manager.install([]),/at least one/);
 for(const id of ['chat','chat-projector'])await writeFile(join(root,'models',id+'.gguf'),'yes');
 const engine=join(root,'runtime',process.platform==='win32'?'':process.platform==='darwin'?'darwin':'linux-'+process.arch,'ollama',process.platform==='win32'?'ollama.exe':'ollama');await mkdir(dirname(engine),{recursive:true});await writeFile(engine,'engine');await manager.refresh();assert.equal(manager.has('chat'),true);
 await manager.setActive('chat',false);assert.equal(manager.has('chat'),false);assert.equal(manager.snapshot().setupRequired,false);await manager.setActive('chat',true);
 await mkdir(join(root,'data'),{recursive:true});await writeFile(join(root,'data/generated.wav'),'keep');await assert.rejects(manager.uninstall('chat','wrong'),/Confirm/);await manager.uninstall('chat','UNINSTALL_chat');assert.equal(manager.snapshot().setupRequired,true);assert.equal(await readFile(join(root,'data/generated.wav'),'utf8'),'keep');
});
test('installation exposes progress, blocks concurrent work and cancels its owned worker',async t=>{
 const root=await fixture(t);await writeFile(join(root,'model-manifest.json'),JSON.stringify([{id:'chat',filename:'chat.gguf',path:'models/chat.gguf',bytes:100,repo:'test/chat'}]));await writeFile(join(root,'video-model-manifest.json'),'[]');await writeFile(join(root,'audio-model-manifest.json'),JSON.stringify(['speech','music','sfx'].map(id=>({id,revision:'1'.repeat(40),files:[],repo:'test/'+id}))));
 await mkdir(join(root,'scripts'));await writeFile(join(root,'scripts/install-model.mjs'),"process.send({type:'model',id:'chat',phase:'weights',message:'Downloading test model'});process.send({type:'download',label:'test',loaded:42,total:100,phase:'downloading'});setInterval(()=>{},1000);");
 await writeFile(join(root,'sulphur-model-manifest.json'),'[]');const manager=new ModelManager(root);await writeFile(join(root,'flux2-model-manifest.json'),'[]');await manager.init();await manager.install(['chat']);
 for(let i=0;i<100&&manager.job.percent!==42;i++)await new Promise(r=>setTimeout(r,20));
 assert.equal(manager.job.percent,42);await assert.rejects(manager.install(['chat']),/current installation/);
 await manager.cancel();for(let i=0;i<100&&manager.job.status!=='cancelled';i++)await new Promise(r=>setTimeout(r,20));
 assert.equal(manager.child,null);assert.equal(manager.job.status,'cancelled');assert.equal(manager.snapshot().setupRequired,true);
});

test('LTX replacement ignores the previous Sulphur installation state',async t=>{
 const root=await fixture(t);await mkdir(join(root,'models'),{recursive:true});
 await writeFile(join(root,'model-manifest.json'),'[]');
 const ids=['ltx-transformer','ltx-encoder','ltx-vae','ltx-audio-vae','ltx-upscaler'];
 await writeFile(join(root,'video-model-manifest.json'),JSON.stringify(ids.map(id=>({id,path:'models/'+id+'.safetensors',bytes:7,repo:'test/ltx',filename:id+'.safetensors'}))));
 await writeFile(join(root,'models/video-installed.json'),JSON.stringify({models:[{id:'video',path:'models/old.safetensors',bytes:3,repo:'test/sulphur'}]}));
 await writeFile(join(root,'models/old.safetensors'),'old');
 await writeFile(join(root,'audio-model-manifest.json'),JSON.stringify(['speech','music','sfx'].map(id=>({id,revision:'1'.repeat(40),files:[],repo:'test/'+id}))));
 await writeFile(join(root,'sulphur-model-manifest.json'),'[]');const manager=new ModelManager(root);await writeFile(join(root,'flux2-model-manifest.json'),'[]');await manager.init();const video=manager.items.find(m=>m.id==='video');
 assert.equal(video.name,'LTX-2.5');assert.equal(video.installed,false);assert.equal(video.weights,false);assert.equal(video.bytes,35);
 assert.equal(await readFile(join(root,'models/old.safetensors'),'utf8'),'old');
});
