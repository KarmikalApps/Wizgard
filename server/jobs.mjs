import { randomUUID } from 'node:crypto';
export class JobQueue {
  constructor({run,pause,resume,maxChats=2,timings={},onTiming=()=>{},onChange=()=>{}}){this.sequence=0;this.timings=timings;this.onTiming=onTiming;this.maxChats=maxChats;this.jobs=new Map();this.run=run;this.pauseEngine=pause;this.resumeEngine=resume;this.onChange=onChange;this.controlling=false;this.pausedOwner=null;}
  get busy(){return [...this.jobs.values()].some(j=>!['complete','error','stopped'].includes(j.state));}
  forConversation(id){return [...this.jobs.values()].find(j=>j.conversationId===id&&!['complete','error','stopped'].includes(j.state));}
  create(input,conversation){
    if(this.forConversation(conversation.id))throw Object.assign(new Error('This conversation already has an unfinished response.'),{status:409});
    if([...this.jobs.values()].filter(j=>!['complete','error','stopped'].includes(j.state)).length>=20)throw Object.assign(new Error('At most 20 unfinished conversations can be queued.'),{status:409});
    const job={id:randomUUID(),order:++this.sequence,activeMillis:0,conversationId:conversation.id,input,conversation,state:'queued',ready:false,kind:['chat','auto'].includes(input.mode)?'chat':'exclusive',abort:new AbortController(),child:null,events:[],listeners:new Set(),createdAt:new Date().toISOString(),status:'Waiting for a local engine…',progress:null};
    this.jobs.set(job.id,job);this.emit(job,'conversation',{conversation});this.onChange();return job;
  }
  emit(job,event,data){
    if(event==='status'){job.status=data.text;job.progress=data.progress??null;}
    if(event==='route')job.route=data.route;
    if(event==='error')job.failed=true;
    const saved=structuredClone(data);job.events.push({event,data:saved});for(const listener of job.listeners)listener(event,saved);
  }
  pending(){return [...this.jobs.values()].filter(j=>!j.executing&&['queued','paused'].includes(j.state)).sort((a,b)=>a.order-b.order);}
  timingKey(job){const mode=job.route||job.input.mode,s=job.input.settings||{};return JSON.stringify([mode,mode==='image'?[s.imageModel,s.width,s.height,s.steps,s.backend]:mode==='video'?[s.videoModel,s.videoWidth,s.videoHeight,s.videoSeconds,s.videoFps,s.videoAudio]:mode==='music'?[s.musicSeconds]:mode==='sfx'?[s.sfxSeconds]:mode==='speech'?[Math.ceil((job.input.prompt?.length||0)/200)]:[!!s.thinking]]);}
  activeSeconds(job,now=Date.now()){return (job.activeMillis+(job.activeSince==null?0:now-job.activeSince))/1000;}
  account(job){if(job.activeSince!=null){job.activeMillis+=Date.now()-job.activeSince;job.activeSince=null;}}
  estimate(job){const samples=this.timings[this.timingKey(job)];return Array.isArray(samples)&&samples.length?samples.reduce((a,b)=>a+b,0)/samples.length:null;}
  remember(job){const seconds=this.activeSeconds(job);if(job.state!=='complete'||seconds<=0)return;const key=this.timingKey(job);this.timings[key]=[...(this.timings[key]||[]),seconds].slice(-6);const keys=Object.keys(this.timings);for(const k of keys.slice(0,Math.max(0,keys.length-200)))delete this.timings[k];this.onTiming(structuredClone(this.timings));}
  completedSnapshot(){return [...this.jobs.values()].filter(j=>j.finishedAt).sort((a,b)=>b.finishedAt.localeCompare(a.finishedAt)).slice(0,30).map(j=>({id:j.id,conversationId:j.conversationId,title:j.conversation.title||'Conversation',state:j.state,route:j.route||j.input.mode,finishedAt:j.finishedAt}));}
  snapshot(){
    const now=Date.now(),running=[...this.jobs.values()].filter(j=>j.executing),pending=this.pending();
    const remaining=j=>{const estimate=this.estimate(j);return estimate===null?null:Math.max(0,Math.round(estimate-this.activeSeconds(j,now)));};
    let waiting=this.pausedOwner||running.some(j=>remaining(j)===null)?null:Math.max(0,...running.map(remaining));let position=0;
    return [...running,...pending].map(j=>{
      const queued=!j.executing,paused=j.state==='paused',estimate=this.estimate(j),waitSeconds=queued&&!paused?waiting:null;
      const queuePosition=queued&&!paused?++position:null;
      if(queued&&!paused)waiting=waiting===null||estimate===null?null:waiting+Math.round(estimate);
      return {id:j.id,conversationId:j.conversationId,title:j.conversation.title||'Conversation',prompt:j.input.prompt,mode:j.route||j.input.mode,state:j.state,route:j.route,status:j.status,progress:j.progress,createdAt:j.createdAt,startedAt:j.startedAt,elapsedSeconds:Math.floor((now-Date.parse(j.createdAt))/1000),activeSeconds:Math.floor(this.activeSeconds(j,now)),remainingSeconds:queued?null:remaining(j),waitSeconds,queuePosition,estimateSource:estimate===null?null:'recent similar jobs',reorderable:queued&&j.ready,blocked:!!this.pausedOwner,sharedPause:!!this.pausedOwner&&j.state==='running',pausable:j.state==='queued'||j.state==='running'};
    });
  }
  reorder(ids){
    const pending=this.pending();
    if(!Array.isArray(ids)||ids.length!==pending.length||new Set(ids).size!==ids.length||pending.some(j=>!j.ready||!ids.includes(j.id)))throw Object.assign(new Error('The queue changed. Refresh and try reordering again.'),{status:409});
    for(const id of ids)this.jobs.get(id).order=++this.sequence;
    this.onChange();this.pump();return this.snapshot();
  }
  ready(job){job.ready=true;this.pump();}
  expire(job){if(job.expiry)return;job.expiry=setTimeout(()=>this.jobs.delete(job.id),300000);job.expiry.unref?.();}
  pump(){
    if(this.stopping||this.controlling||this.pausedOwner)return;
    const active=[...this.jobs.values()].filter(j=>j.executing),queued=this.pending().filter(j=>j.ready&&j.state==='queued');
    if(active.some(j=>j.kind==='exclusive'))return;
    for(const job of queued){
      if(active.length&&(job.kind!=='chat'||active.length>=this.maxChats))break;
      job.state='running';job.executing=true;job.started=true;job.startedAt??=new Date().toISOString();job.activeSince=Date.now();active.push(job);this.onChange();
      if(job.continuation){const resume=job.continuation;job.continuation=null;resume();break;}
      void this.run(job).catch(e=>{job.failed=true;this.emit(job,'error',{message:e.message});}).finally(async()=>{
        if(this.pausedOwner===job.id){try{await this.resumeEngine();}catch{}this.pausedOwner=null;}
        this.account(job);job.executing=false;job.state=job.abort.signal.aborted?'stopped':job.failed?'error':'complete';job.finishedAt=new Date().toISOString();this.remember(job);this.emit(job,'end',{});this.onChange();
        this.expire(job);this.pump();
      });
      if(job.kind==='exclusive'||active.length>=this.maxChats)break;
    }
  }
  async exclusive(job){
    if(job.kind==='exclusive')return;
    this.account(job);job.kind='exclusive';job.executing=false;job.state='queued';job.status='Waiting for exclusive GPU access…';
    await new Promise((resolve,reject)=>{const abort=()=>{job.continuation=null;reject(job.abort.signal.reason);};job.continuation=()=>{job.abort.signal.removeEventListener('abort',abort);resolve();};job.abort.signal.addEventListener('abort',abort,{once:true});this.pump();});
    job.abort.signal.throwIfAborted();
  }
  async control(id,action){
    const job=this.jobs.get(id);if(!job||['complete','error','stopped'].includes(job.state))throw Object.assign(new Error('This generation has already finished.'),{status:409});
    if(this.controlling)throw Object.assign(new Error('Wait for the current pause/resume operation.'),{status:409});
    this.controlling=true;
    try {
      if(action==='pause'){
        if(job.state==='queued'){job.state='paused';job.status='Paused in queue.';}
        else if(job.state==='running'&&!this.pausedOwner){await this.pauseEngine(job);if(!job.executing){await this.resumeEngine();throw new Error('The engine has already finished.');}this.pausedOwner=job.id;for(const active of this.jobs.values())if(active.executing)this.account(active);job.state='paused';}
        else throw new Error('Resume the paused engine first.');
      } else if(action==='resume'){
        if(job.state!=='paused')throw new Error('This generation is not paused.');
        if(job.executing){await this.resumeEngine();this.pausedOwner=null;for(const active of this.jobs.values())if(active.executing)active.activeSince=Date.now();job.state='running';}
        else {job.state='queued';job.status='Waiting for a local engine…';}
      } else if(action==='stop'){
        if(this.pausedOwner){await this.resumeEngine();const owner=this.jobs.get(this.pausedOwner);if(owner)owner.state='running';this.pausedOwner=null;for(const active of this.jobs.values())if(active.executing)active.activeSince=Date.now();}
        job.abort.abort();if(!job.executing){job.state='stopped';job.finishedAt=new Date().toISOString();if(!job.started){this.emit(job,'error',{message:'Generation stopped.',conversation:job.conversation});this.emit(job,'end',{});this.expire(job);}}
      } else throw Object.assign(new Error('Unknown generation action.'),{status:400});
    } finally {this.controlling=false;this.onChange();this.pump();}
  }
  async stopAll(){this.stopping=true;for(const j of [...this.jobs.values()])if(!['complete','error','stopped'].includes(j.state))await this.control(j.id,'stop');}
}
