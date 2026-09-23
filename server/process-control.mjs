import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
const exec=promisify(execFile);
export async function processTable() {
  const {stdout}=await exec('ps',['-axo','pid=,ppid=,time=,rss='],{timeout:5000,maxBuffer:4e6});
  return stdout.trim().split('\n').map(line=>{
    const [pid,ppid,time,rss]=line.trim().split(/\s+/);const [days,clock]=time.includes('-')?time.split('-'):['0',time];
    const parts=clock.split(':').map(Number);let seconds=0;for(const n of parts)seconds=seconds*60+n;
    return {pid:Number(pid),ppid:Number(ppid),cpuSeconds:Number(days)*86400+seconds,rss:Number(rss)*1024};
  });
}
export function descendants(rows,roots) {
  const ids=new Set(roots);let changed=true;
  while(changed){changed=false;for(const row of rows)if(ids.has(row.ppid)&&!ids.has(row.pid)){ids.add(row.pid);changed=true;}}
  return rows.filter(row=>ids.has(row.pid));
}
export class ProcessFreezer {
  constructor(root){this.root=root;this.frozen=[];this.blocked=false;this.waiters=new Set();}
  async wait(signal){signal?.throwIfAborted();if(!this.blocked)return;await new Promise((resolve,reject)=>{const done=()=>{this.waiters.delete(done);signal?.removeEventListener('abort',abort);resolve();};const abort=()=>{this.waiters.delete(done);reject(signal.reason);};this.waiters.add(done);signal?.addEventListener('abort',abort,{once:true});});signal?.throwIfAborted();}
  async windows(action,records){const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(this.root,'scripts/process-control.ps1'),'-Action',action,'-Payload',Buffer.from(JSON.stringify(records)).toString('base64')],{windowsHide:true,timeout:15000,maxBuffer:4e6});return JSON.parse(stdout||'[]');}
  async pause(roots){
    if(this.blocked)return;if(!roots.length)throw new Error('The engine is preparing. Try Pause again once generation starts.');
    this.blocked=true;
    try {
      if(process.platform==='win32')this.frozen=await this.windows('suspend',roots);
      else {const rows=descendants(await processTable(),roots);for(const row of rows){try{process.kill(row.pid,'SIGSTOP');this.frozen.push(row);}catch(e){if(e.code!=='ESRCH')throw e;}}}
      if(!this.frozen.length)throw new Error('The engine has already finished.');
    } catch(e){await this.resume().catch(()=>{});throw e;}
  }
  async resume(){
    if(this.frozen.length){if(process.platform==='win32')await this.windows('resume',this.frozen);else for(const row of this.frozen){try{process.kill(row.pid,'SIGCONT');}catch(e){if(e.code!=='ESRCH')throw e;}}}
    this.frozen=[];this.blocked=false;for(const done of this.waiters)done();
  }
}
