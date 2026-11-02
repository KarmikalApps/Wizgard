import {spawn,execFile} from 'node:child_process';
import {join,dirname} from 'node:path';
import {createWriteStream} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
import {installedModels} from '../scripts/models.mjs';
import {llamaExecutable} from '../scripts/setup-llama.mjs';
import {chatOption} from '../src/chat-options.mjs';
import {localFetch} from './local-fetch.mjs';
const endpoint='http://127.0.0.1:11436';
export function llamaBody(body){return {model:'wizgard-deepseek41',messages:body.messages.map(m=>({role:m.role,content:m.images?.length?[{type:'text',text:m.content},...m.images.map(image=>({type:'image_url',image_url:{url:'data:image/png;base64,'+image}}))]:m.content})),stream:!!body.stream,stream_options:body.stream?{include_usage:true}:undefined,max_tokens:body.options?.num_predict??-1,temperature:body.options?.temperature??.7,top_p:body.options?.top_p??.9,chat_template_kwargs:{enable_thinking:body.think!==false},...(body.format?{response_format:{type:'json_schema',json_schema:{name:'response',strict:true,schema:body.format}}}:{})};}
export function ollamaPart(data){const choice=data.choices?.[0],m=choice?.delta||choice?.message||{};return {message:{content:m.content||'',thinking:m.reasoning_content||m.reasoning||''},...(choice?.finish_reason?{done:true,done_reason:choice.finish_reason==='length'?'length':'stop'}:{}),...(data.usage?{eval_count:data.usage.completion_tokens}:{} )};}
export class LlamaChat {
 constructor(root){this.root=root;this.child=null;this.key=null;}
 async start(signal,emit){
  if(this.child&&this.child.exitCode===null)return;
  const exe=llamaExecutable(this.root);if(!exe)throw new Error('Install the DeepSeek runtime through Manage Models.');
  const occupied=await localFetch(endpoint+'/health',{signal:AbortSignal.timeout(1000)}).then(()=>true).catch(()=>false);if(occupied)throw new Error('Port 11436 is already in use. Wizgard will not take over an unrelated server.');
  const def=chatOption('deepseek41'),models=await installedModels(this.root,def),files=def.ids.map(id=>models.find(m=>m.id===id));
  if(files.some(f=>!f))throw new Error('DeepSeek model files are incomplete.');
  this.key=randomBytes(24).toString('hex');
  emit('status',{text:'Loading DeepSeek 4.1; large models can take several minutes…'});
  const log=createWriteStream(join(this.root,'data/logs/deepseek41.log'),{flags:'a'});let tail='',spawnError=null;
  const args=['-m',join(this.root,files[0].path),'--mmproj',join(this.root,files.at(-1).path),'--host','127.0.0.1','--port','11436','--api-key',this.key,'--alias','wizgard-deepseek41','--jinja','--ctx-size','32768','--parallel','1','--n-gpu-layers','auto','--no-webui'];
  const child=spawn(exe,args,{cwd:dirname(exe),windowsHide:true,detached:process.platform!=='win32',env:{...process.env,LD_LIBRARY_PATH:dirname(exe)},stdio:['ignore','pipe','pipe']});this.child=child;
  const output=d=>{log.write(d);tail=(tail+d.toString()).slice(-1600);};child.stdout.on('data',output);child.stderr.on('data',output);child.on('error',e=>{tail=e.message;spawnError=e;});child.on('close',()=>log.end());
  try{while(true){signal.throwIfAborted();if(spawnError)throw spawnError;if(child.exitCode!==null||child.signalCode!==null)throw new Error('DeepSeek engine stopped: '+tail);await this.waitForResume?.(signal);
   const ready=await localFetch(endpoint+'/health',{headers:{Authorization:'Bearer '+this.key},signal:AbortSignal.timeout(3000)}).then(r=>r.ok).catch(()=>false);if(ready)return;
   await sleep(1000,undefined,{signal});
  }}catch(e){await this.stop();throw e;}
 }
 async request(body,signal){
  await this.waitForResume?.(signal);
  const response=await localFetch(endpoint+'/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.key},body:JSON.stringify(llamaBody(body)),signal});
  if(!response.ok)throw new Error('DeepSeek: '+(await response.text()).slice(0,800));
  if(!body.stream){const data=await response.json(),part=ollamaPart(data);return Response.json({...part,done:true,eval_count:data.usage?.completion_tokens||0});}
  const encoder=new TextEncoder(),decoder=new TextDecoder();let buffer='',final=null,usage=null;
  const transformed=new ReadableStream({start:async controller=>{try{
   const line=s=>{if(!s.startsWith('data:'))return;const value=s.slice(5).trim();if(value==='[DONE]')return;const data=JSON.parse(value);if(data.error)throw new Error(data.error.message||'DeepSeek stream error');const part=ollamaPart(data);if(data.usage)usage=data.usage;if(part.done){final={...part};delete part.done;delete part.done_reason;}if(part.message.content||part.message.thinking)controller.enqueue(encoder.encode(JSON.stringify(part)+'\n'));};
   for await(const bytes of response.body){signal.throwIfAborted();buffer+=decoder.decode(bytes,{stream:true});const lines=buffer.split('\n');buffer=lines.pop();for(const s of lines)line(s);}
   buffer+=decoder.decode();if(buffer.trim())line(buffer);if(!final)throw new Error('DeepSeek stream ended without a completion marker.');controller.enqueue(encoder.encode(JSON.stringify({done:true,done_reason:final.done_reason||'stop',eval_count:usage?.completion_tokens||0})+'\n'));controller.close();
  }catch(e){controller.error(e);}}});return new Response(transformed);
 }
 async stop(){
  const child=this.child;this.child=null;this.key=null;
  if(!child||child.exitCode!==null||child.signalCode!==null||!child.pid)return;
  if(process.platform==='win32')await new Promise(r=>execFile('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},r));
  else {
   const exited=new Promise(r=>child.once('close',r));
   try{process.kill(-child.pid,'SIGTERM');}catch{}
   await Promise.race([exited,sleep(3000)]);
   if(child.exitCode===null&&child.signalCode===null){try{process.kill(-child.pid,'SIGKILL');}catch{}await Promise.race([exited,sleep(1000)]);}
  }
 }
}
