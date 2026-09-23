import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cpus, totalmem } from 'node:os';
import { ProcessFreezer, processTable, descendants } from './process-control.mjs';
const exec=promisify(execFile);
export class ResourceMonitor {
  constructor(root){this.control=new ProcessFreezer(root);this.previous=new Map();this.at=0;this.value=null;this.pending=null;}
  async read(){if(this.pending)return this.pending;if(this.value&&Date.now()-this.value.timestamp<1800)return this.value;this.pending=this.sample().finally(()=>this.pending=null);return this.pending;}
  async sample(){
    const now=Date.now();let rows=[],gpu=null,gpuScope='unavailable',error=null;
    try {if(process.platform==='win32'){const data=await this.control.windows('metrics',[process.pid]);rows=data.processes||[];if(Number.isFinite(data.gpuPercent)){gpu=data.gpuPercent;gpuScope='app';}}
      else rows=descendants(await processTable(),[process.pid]);
    } catch {error='Process metrics unavailable';}
    let delta=0;for(const row of rows){const key=row.pid+':'+(row.start||'');const old=this.previous.get(key);if(old!==undefined)delta+=Math.max(0,row.cpuSeconds-old);}
    const cpu=this.at&&rows.length?Math.min(100,delta/((now-this.at)/1000)/cpus().length*100):null;
    this.previous=new Map(rows.map(r=>[r.pid+':'+(r.start||''),r.cpuSeconds]));this.at=now;
    let vram=null,vramTotal=null;
    try {
      const [{stdout:device},{stdout:apps}]=await Promise.all([
        exec('nvidia-smi',['--query-gpu=utilization.gpu,memory.total','--format=csv,noheader,nounits'],{windowsHide:true,timeout:2500,maxBuffer:2e5}),
        exec('nvidia-smi',['--query-compute-apps=pid,used_gpu_memory','--format=csv,noheader,nounits'],{windowsHide:true,timeout:2500,maxBuffer:2e5})]);
      const devices=device.trim().split('\n').map(l=>l.split(',').map(v=>Number(v.trim())));vramTotal=devices.reduce((n,r)=>n+(Number.isFinite(r[1])?r[1]*1048576:0),0)||null;
      if(gpu===null&&devices.some(r=>Number.isFinite(r[0]))){gpu=Math.max(...devices.map(r=>r[0]).filter(Number.isFinite));gpuScope='device';}
      const own=new Set(rows.map(r=>r.pid)),matching=apps.trim().split('\n').map(l=>l.split(',').map(v=>Number(v.trim()))).filter(r=>own.has(r[0]));
      if(matching.length&&matching.every(r=>Number.isFinite(r[1])))vram=matching.reduce((n,r)=>n+r[1]*1048576,0);
    } catch {}
    return this.value={timestamp:Date.now(),cpuPercent:cpu,ramBytes:rows.length?rows.reduce((n,r)=>n+r.rss,0):null,ramTotal:totalmem(),gpuPercent:gpu,gpuScope,vramBytes:vram,vramTotal,processCount:rows.length,error};
  }
}
