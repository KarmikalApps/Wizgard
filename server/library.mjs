import { generationRecord } from './generation-record.mjs';
import { readFile, writeFile, mkdir, rename, stat, readdir, copyFile, unlink, realpath } from 'node:fs/promises';
import { join, resolve, dirname, basename, extname, isAbsolute, sep, relative } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export class GeneratedLibrary {
  constructor(root) { this.root = root; this.data = join(root,'data'); this.items = []; this.mutations=Promise.resolve(); }
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
    for(const item of this.items)if(!item.generation){
      for(const conversation of conversations){const index=conversation.messages.findIndex(m=>m.libraryId===item.id||m[item.type+'Url']===item.url);if(index<0)continue;
        const message=conversation.messages[index],user=conversation.messages.slice(0,index).findLast(m=>m.role==='user');
        item.generation=generationRecord(message,user?.request?{...user.request,prompt:user.content}:null);changed=true;break;
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
  locked(action) {const next=this.mutations.then(action);this.mutations=next.catch(()=>{});return next;}
  async register(message,request=null,brief=null) { return this.locked(()=>this.registerUnlocked(message,request,brief)); }
  async registerUnlocked(message,request,brief) {
    const type=message.imageUrl?'image':message.videoUrl?'video':'audio';
    const folders={image:'images',video:'videos',audio:'audio'};
    const url=message[type+'Url'],name=basename(url),source=join(this.data,folders[type],name);
    if(!/^[0-9a-f-]{36}\.(png|mp4|webm|wav|flac|mp3)$/.test(name))throw new Error('Unexpected generated filename.');
    const output=join(this.settings().outputLocation,'Wizgard',folders[type]);await mkdir(output,{recursive:true});
    const path=join(output,name),id=randomUUID();await copyFile(source,path,1);
    message.generation=generationRecord(message,request,brief);
    const item={favorite:false,generation:message.generation,id,type,path,filename:name,url:'/library-files/'+id,prompt:message[type+'Prompt'],model:message.model,createdAt:message.createdAt||new Date().toISOString(),bytes:(await stat(path)).size,seconds:message.seconds,audioKind:message.audioKind};
    this.items.unshift(item);
    try { await this.save(); } catch(e) { this.items=this.items.filter(x=>x.id!==id);await unlink(path).catch(()=>{});throw e; }
    await unlink(source).catch(()=>{});message[type+'Url']=item.url;message.libraryId=id;return item;
  }
  list(category='all',page=1,filters={}) {
    if(!['all','image','video','audio'].includes(category))throw Object.assign(new Error('Unknown library category.'),{status:400});
    const query=String(filters.q||'').slice(0,500).toLocaleLowerCase(),model=String(filters.model||'');
    for(const key of ['from','to'])if(filters[key]&&(!/^\d{4}-\d{2}-\d{2}$/.test(filters[key])||!Number.isFinite(Date.parse(filters[key]))||new Date(filters[key]).toISOString().slice(0,10)!==filters[key]))throw Object.assign(new Error('Choose a valid date.'),{status:400});
    if(filters.from&&filters.to&&filters.from>filters.to)throw Object.assign(new Error('The end date must be on or after the start date.'),{status:400});
    const filtered=this.items.filter(i=>(category==='all'||i.type===category)&&(!query||(i.prompt||'').toLocaleLowerCase().includes(query))&&(!model||i.model===model)&&(!filters.favorite||i.favorite===true)&&(!filters.from||i.createdAt.slice(0,10)>=filters.from)&&(!filters.to||i.createdAt.slice(0,10)<=filters.to)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
    const pages=Math.max(1,Math.ceil(filtered.length/20));page=Math.max(1,Math.min(pages,Math.floor(Number(page)||1)));
    return {models:[...new Set(this.items.map(i=>i.model).filter(Boolean))].sort(),items:filtered.slice((page-1)*20,page*20).map(({path,...i})=>i),page,pages,total:filtered.length,pageSize:20,counts:{all:this.items.length,...Object.fromEntries(['image','video','audio'].map(t=>[t,this.items.filter(i=>i.type===t).length]))}};
  }
  async favorite(id,value){
    if(typeof value!=='boolean')throw Object.assign(new Error('Choose a favorite state.'),{status:400});
    return this.locked(async()=>{const item=this.items.find(i=>i.id===id);if(!item)throw Object.assign(new Error('Generated file not found.'),{status:404});const previous=item.favorite;item.favorite=value;try{await this.save();}catch(e){item.favorite=previous;throw e;}return {id,favorite:value};});
  }
  async file(id) {const item=this.items.find(i=>i.id===id);if(!item)throw Object.assign(new Error('Generated file not found.'),{status:404});try{await stat(item.path);}catch(e){if(e.code==='ENOENT'){await this.remove({id});throw Object.assign(new Error('Generated file is missing; its library entry was removed.'),{status:404});}throw e;}return item;}
  async reveal(id) {
    const item=await this.file(id);
    const exe=process.platform==='win32'?'explorer.exe':process.platform==='darwin'?'open':'xdg-open';
    const args=process.platform==='win32'?['/select,',item.path]:process.platform==='darwin'?['-R',item.path]:[dirname(item.path)];
    await new Promise((res,rej)=>{const child=spawn(exe,args,{windowsHide:true,stdio:'ignore'});child.once('error',rej);child.once('spawn',res);child.unref();});
  }
  async pruneMissing() {
    return this.locked(async()=>{const missing=[];for(const item of this.items){try{await stat(item.path);}catch(e){if(e.code==='ENOENT')missing.push(item.id);}}
      if(missing.length){this.items=this.items.filter(i=>!missing.includes(i.id));await this.save();}return missing.length;});
  }
  async remove({id,category}) {
    if(!id&&!['all','image','video','audio'].includes(category))throw Object.assign(new Error('Unknown library category.'),{status:400});
    return this.locked(async()=>{
      const selected=this.items.filter(i=>id?i.id===id:category==='all'||i.type===category),removed=new Set();let failed=0;
      for(const item of selected){try{await unlink(item.path);removed.add(item.id);}catch(e){if(e.code==='ENOENT')removed.add(item.id);else failed++;}}
      this.items=this.items.filter(i=>!removed.has(i.id));await this.save();return {removed:removed.size,failed};
    });
  }
  async clear() {const result=await this.remove({category:'all'});if(result.failed)throw new Error('Some generated files are in use. Close their players and retry Clear Workspace.');}
}
