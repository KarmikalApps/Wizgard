import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateRequest } from '../server/policy.mjs';
import { VideoRuntime } from '../server/video.mjs';
import { videoModels, videoModel } from '../server/video-models.mjs';
import { buildSulphurWorkflow } from '../server/sulphur-workflow.mjs';
import { buildLtx25Workflow } from '../server/ltx25-workflow.mjs';
import { ModelManager } from '../server/model-manager.mjs';
import { normalizeVideoSettings, switchVideoSettings, videoFrames } from '../src/video-options.mjs';
import { huggingFaceHeaders } from '../scripts/huggingface-auth.mjs';

test('video bounds follow the selected model, including Auto requests', () => {
  const settings=(options,mode='video')=>validateRequest({prompt:'Create a video of a boat',mode,settings:options}).settings;
  assert.equal(settings({}).videoModel,'ltx25');
  assert.equal(settings({videoModel:'ltx25',videoWidth:1920,videoHeight:1080,videoFps:50,videoSeconds:20,videoAudio:true},'auto').videoAudio,true);
  assert.throws(()=>settings({videoModel:'sulphur',videoWidth:1920,videoHeight:1080}),/resolution/);
  assert.throws(()=>settings({videoModel:'sulphur',videoFps:50}),/frame rate/);
  assert.throws(()=>settings({videoModel:'sulphur',videoSeconds:20}),/duration/);
  for(const id of ['removed-model','__proto__','toString']) { assert.throws(()=>settings({videoModel:id}),/Choose LTX/);assert.throws(()=>videoModel(id),/Choose LTX/); }
  for(const fps of [24,25,48,50])assert.equal((videoFrames(2,fps)-1)%8,0);
});
test('switching models restores separate profiles and migrates removed selections', () => {
  const settings=normalizeVideoSettings({videoModel:'old-video',videoWidth:1920,videoHeight:1080,videoFps:50,videoSeconds:20,videoAudio:true});
  assert.equal(settings.videoModel,'ltx25');
  const sulphur=switchVideoSettings(settings,'sulphur');
  assert.equal(sulphur.videoWidth,512);assert.equal(sulphur.videoFps,24);assert.equal(sulphur.videoSeconds,2);
  const restored=switchVideoSettings({...sulphur,videoAudio:false},'ltx25');
  assert.equal(restored.videoWidth,1920);assert.equal(restored.videoHeight,1080);assert.equal(restored.videoFps,50);assert.equal(restored.videoSeconds,20);assert.equal(restored.videoAudio,true);
});
test('LTX two-stage workflow refines latent HD and crops padding to exact 1080p', () => {
  const args={transformer:'model',encoder:'encoder',vae:'video-vae',audioVae:'audio-vae',upscaler:'upscaler',prompt:'boat',seed:1,width:1920,height:1080,frames:49,fps:24,outputId:'test'};
  const g=buildLtx25Workflow(args);
  assert.equal(g['7'].inputs.width,960);assert.equal(g['7'].inputs.height,544);
  assert.equal(g['22'].class_type,'LTXVLatentUpsampler');
  assert.deepEqual(g['23'].inputs.audio_latent,['16',1]);
  assert.deepEqual(g['25'].inputs.latent_image,['23',0]);
  assert.deepEqual(g['17'].inputs.samples,['26',0]);
  assert.equal(g['34'].inputs.width,1920);assert.equal(g['34'].inputs.height,1080);assert.equal(g['34'].inputs.y,4);
  assert.deepEqual(g['19'].inputs.images,['34',0]);assert.equal('audio' in g['19'].inputs,false);
  const image=buildLtx25Workflow({...args,audio:true,sourceImages:['boat.png']});
  assert.deepEqual(image['10'].inputs.video_latent,['32',0]);assert.deepEqual(image['23'].inputs.video_latent,['33',0]);
  assert.deepEqual(image['18'].inputs.samples,['26',1]);assert.deepEqual(image['19'].inputs.audio,['18',0]);
  assert.throws(()=>buildLtx25Workflow({...args,sourceImages:['one','two']}),/one opening/);
});
test('Sulphur retains sound and multiple image guides', () => {
  const args={checkpoint:'model',encoder:'gemma',lora:'speed',prompt:'boat',seed:1,width:512,height:320,frames:49,outputId:'test'};
  const silent=buildSulphurWorkflow({...args,audio:false});assert.equal(silent['19'].inputs.fps,24);assert.equal(silent['18'],undefined);
  const sound=buildSulphurWorkflow({...args,audio:true,sourceImages:['one','two']});
  assert.deepEqual(sound['19'].inputs.audio,['18',0]);assert.equal(sound['33'].inputs.frame_idx,48);assert.deepEqual(sound['17'].inputs.samples,['60',2]);
});
test('video installations are independent and uninstalling one preserves the other', async()=>{
  if(!['win32','linux'].includes(process.platform))return;
  const root=await mkdtemp(join(tmpdir(),'wizgard-video-choice-'));
  try {
    const runtimeDir=join(root,'runtime','video-'+process.platform+'-'+process.arch);await mkdir(runtimeDir,{recursive:true});
    const engine=join(runtimeDir,'python');await writeFile(engine,'engine');await writeFile(join(runtimeDir,'ready.json'),JSON.stringify({python:engine}));
    await mkdir(join(root,'models/video'),{recursive:true});await writeFile(join(root,'model-manifest.json'),'[]');
    await writeFile(join(root,'audio-model-manifest.json'),JSON.stringify(['speech','music','sfx'].map(id=>({id,revision:'1'.repeat(40),files:[],repo:'test/'+id}))));
    for(const [id,config] of Object.entries(videoModels)){
      const models=config.ids.map((key,index)=>({id:key,path:'models/video/'+id+'-'+index,bytes:1}));
      for(const m of models)await writeFile(join(root,m.path),'x');
      await writeFile(join(root,config.catalog.stateFile),JSON.stringify({models}));await writeFile(join(root,config.catalog.catalogFile),JSON.stringify(models));
    }
    const runtime=new VideoRuntime(root);assert.deepEqual((await runtime.choices()).map(m=>m.available),[true,true]);
    const manager=new ModelManager(root);await writeFile(join(root,'flux2-model-manifest.json'),'[]');await manager.init();assert.deepEqual(manager.snapshot().active,['video']);
    await manager.uninstall('video','UNINSTALL_video');
    assert.equal(manager.has('video'),true);assert.deepEqual((await runtime.choices()).map(m=>m.available),[false,true]);
    assert.equal(await readFile(join(root,'models/video/sulphur-0'),'utf8'),'x');
    await assert.rejects(stat(join(root,'models/video/ltx25-0')),{code:'ENOENT'});
    await manager.setActive('sulphur',false);assert.equal(manager.has('video'),false);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('Hugging Face credentials are sent only to its HTTPS origin', async()=>{
  const env={HF_TOKEN:'fixture-token'};
  assert.deepEqual(await huggingFaceHeaders('https://huggingface.co/publisher/model',env),{Authorization:'Bearer fixture-token'});
  for(const url of ['http://huggingface.co/model','https://example.com','https://huggingface.co.example.com'])assert.deepEqual(await huggingFaceHeaders(url,env),{});
});
