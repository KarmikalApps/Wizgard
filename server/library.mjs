import { readFile, writeFile, mkdir, rename, stat, readdir, copyFile, unlink, realpath } from 'node:fs/promises';
import { join, resolve, dirname, basename, extname, isAbsolute, sep, relative } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export class GeneratedLibrary {
  constructor(root) { this.root = root; this.data = join(root,'data'); this.items = []; }
  async init() {
    await mkdir(this.data,{recursive:true});
    this.config = JSON.parse(await readFile(join(this.data,'output-settings.json'),'utf8').catch(e => { if(e.code === 'ENOENT') return '{}'; throw e; }));
    this.items = JSON.parse(await readFile(join(this.data,'generated-library.json'),'utf8').catch(e => { if(e.code === 'ENOENT') return '[]'; throw e; }));
    for(const item of this.items) if(item.projectPath) {const path=resolve(this.root,item.projectPath);if(!path.startsWith(resolve(this.root)+sep))throw new Error('Invalid portable library path.');item.path=path;}
    const conversations = [];
    for (const name of await readdir(join(this.data,'conversations')).catch(()=>[])) if(name.endsWith('.json')) { try { conversations.push(JSON.parse(await readFile(join(this.data,'conversations',name),'utf8'))); } catch {} }
    let changed=false;
    for(const [type,folder,prefix] of [['image','images','/generated/'],['video','videos','/generated-videos/'],['audio','audio','/generated-audio/']]) {
      for(const name of await readdir(join(this.data,folder)).catch(()=>[])) {
        if(!/^[0-9a-f-]{36}\.(png|mp4|webm|wav|flac|mp3)$/.test(name)) continue;
        const path=join(this.data,folder,name); if(this.items.some(i=>i.path===path))continue;
        const message=conversations.flatMap(c=>c.messages).find(m=>m[type+'Url']===prefix+name);
        const info=await stat(path); this.items.push({id:randomUUID(),type,path,filename:name,url:prefix+name,prompt:message?.[type+'Prompt']||'Generated '+type,model:message?.model,createdAt:message?.createdAt||info.mtime.toISOString(),bytes:info.size,seconds:message?.seconds});changed=true;
      }
    }
    if(changed)await this.save();
  }
  settings() { return { outputLocation:this.config.outputLocation||join(this.data,'outputs'),custom:!!this.config.outputLocation }; }
  async configure(location) {
    if(typeof location!=='string'||location.length>2000||location.includes('\0')||(location.trim()&&!isAbsolute(location.trim())))throw Object.assign(new Error('Enter an absolute folder path, or leave it empty for the default.'),{status:400});
    const folder=location.trim()?resolve(location.trim()):join(this.data,'outputs');
    await mkdir(folder,{recursive:true});
    const probe=join(folder,'.wizgard-write-test-'+randomUUID());await writeFile(probe,'');await unlink(probe);
    this.config={outputLocation:location.trim()?folder:null};
    const path=join(this.data,'output-settings.json');await writeFile(path+'.tmp',JSON.stringify(this.config,null,2));await rename(path+'.tmp',path);
    return this.settings();
  }
  async save() { for(const item of this.items)if(resolve(item.path).startsWith(resolve(this.root)+sep))item.projectPath=relative(this.root,item.path);const p=join(this.data,'generated-library.json');await writeFile(p+'.tmp',JSON.stringify(this.items,null,2));await rename(p+'.tmp',p); }
  async register(message) {
    const type=message.imageUrl?'image':message.videoUrl?'video':'audio';
    const folders={image:'images',video:'videos',audio:'audio'};
    const url=message[type+'Url'],name=basename(url),source=join(this.data,folders[type],name);
    if(!/^[0-9a-f-]{36}\.(png|mp4|webm|wav|flac|mp3)$/.test(name))throw new Error('Unexpected generated filename.');
    const output=join(this.settings().outputLocation,'Wizgard',folders[type]);await mkdir(output,{recursive:true});
    const path=join(output,name),id=randomUUID();await copyFile(source,path,1);
    const item={id,type,path,filename:name,url:'/library-files/'+id,prompt:message[type+'Prompt'],model:message.model,createdAt:message.createdAt||new Date().toISOString(),bytes:(await stat(path)).size,seconds:message.seconds,audioKind:message.audioKind};
    this.items.unshift(item);
    try { await this.save(); } catch(e) { this.items=this.items.filter(x=>x.id!==id);await unlink(path).catch(()=>{});throw e; }
    await unlink(source).catch(()=>{});message[type+'Url']=item.url;message.libraryId=id;return item;
  }
  list(category='all',page=1) {
    if(!['all','image','video','audio'].includes(category))throw Object.assign(new Error('Unknown library category.'),{status:400});
    const filtered=this.items.filter(i=>category==='all'||i.type===category).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const pages=Math.max(1,Math.ceil(filtered.length/20));page=Math.max(1,Math.min(pages,Math.floor(Number(page)||1)));
    return {items:filtered.slice((page-1)*20,page*20).map(({path,...i})=>i),page,pages,total:filtered.length,pageSize:20,counts:{all:this.items.length,...Object.fromEntries(['image','video','audio'].map(t=>[t,this.items.filter(i=>i.type===t).length]))}};
  }
  async file(id) {const item=this.items.find(i=>i.id===id);if(!item)throw Object.assign(new Error('Generated file not found.'),{status:404});await stat(item.path);return item;}
  async reveal(id) {
    const item=await this.file(id);
    const exe=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';
    const args=process.platform==='win32'?['/select,',item.path]:process.platform==='darwin'?['-R',item.path]:[dirname(item.path)];
    await new Promise((res,rej)=>{const child=spawn(exe,args,{windowsHide:true,stdio:'ignore'});child.once('error',rej);child.once('spawn',res);child.unref();});
  }
  async clear() {
    // Delete only individually indexed files, including files in former output locations.
    // Never recursively remove a user-chosen directory.
    const remaining=[];
    for(const item of this.items){try {await unlink(item.path);}catch(e){if(e.code!=='ENOENT')remaining.push(item);}}
    this.items=remaining;await this.save();if(remaining.length)throw new Error('Some generated files are in use. Close their players and retry Clear Workspace.');
  }
}
