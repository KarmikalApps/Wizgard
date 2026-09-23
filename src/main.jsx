import {MessageAttachments,ComposerAttachments} from './Attachments';
import './workspace-features.css';
import { GenerationQueue } from './Queue';
import { NotificationSettings,useGenerationNotifications } from './Notifications';
import { ListOrdered } from 'lucide-react';
import { MatrixBackground } from './MatrixBackground';
import { normalizeAudioSettings } from './audio-options.mjs';
import { ModelManagerView, capabilityIcons } from './Models';
import { ResourceBar } from './Resources';
import { GeneratedLibraryView } from './Library';
import './models.css';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, ArrowDown, RotateCcw, Pause, Play, Activity, Plus, Search, Settings, Settings2, ArrowUp, Square, Sparkles, Image, MessageSquare, ChevronDown, PanelLeftClose, PanelLeftOpen, Download, Copy, Check, Trash2, X, ArrowUpRight, Cpu, HardDrive, CircleHelp, Command, CheckCircle2, LoaderCircle, Power, SlidersHorizontal, Grid2X2, Film, Paperclip, Globe, FileText, Mic, Music2, AudioLines } from 'lucide-react';
import './styles.css';
import { modelDisplayName, modelLabelNote } from './model-labels.mjs';
import { imageOptions, normalizeImageSettings, switchImageSettings } from './image-options.mjs';
import { videoOptions, normalizeVideoSettings, switchVideoSettings, videoFrames } from './video-options.mjs';
import appInfo from '../app-info.json';

const initialSettings = { imageModel:'qwen',imageGuidance:4,width: 1024, height: 1024, steps: 25, seed: -1, backend: 'auto', thinking: false, videoWidth: 512, videoHeight: 320, videoSeconds: 2, videoAudio: false, videoModel: 'ltx25', videoFps:24, web: false, voice: 'Ryan', language: 'Auto', voiceStyle: '', musicLyrics: '', musicSeconds: 120, sfxSeconds: 'auto' };
const examples = [
  { mode:'chat', icon: Sparkles, label: 'Think something through', text: 'Help me think through a creative project I want to start.' },
  { mode:'image', icon: Image, label: 'Make something visual', text: 'Create an image of a tiny cabin inside a glass terrarium, warm evening light, botanical details, cinematic photography.' },
  { mode:'music', icon: Music2, label: 'Set the mood', text: 'Create gentle piano music with a mystical atmosphere, no vocals.' },
  { mode:'speech', icon: Mic, label: 'Give words a voice', text: 'Say "Every great idea starts with a little imagination." in a warm, expressive voice.' },
  { mode:'video', icon: Film, label: 'Bring a scene to life', text: 'Create a video of a paper boat drifting across a moonlit pond.' },
  { mode:'sfx', icon: AudioLines, label: 'Imagine a sound', text: 'Generate 5 seconds of rain softly falling on forest leaves.' },
];
const modeLabels = { auto: 'Auto', chat: 'Chat', image: 'Image', video: 'Video', speech: 'Speech', music: 'Music', sfx: 'Sound Effects' };
const modeIcons = { auto: Sparkles, chat: MessageSquare, image: Image, video: Film, speech: Mic, music: Music2, sfx: AudioLines };
function Mark({ small = false }) { return <div className={'mark ' + (small ? 'small' : '')}><img src="/wizgard-icon.png" alt="" width={small ? 32 : 48} height={small ? 32 : 48} /></div>; }
function CopyButton({ value, prompt = false }) {
  const [copied, setCopied] = useState(false);
  return <button className={prompt?"retry-prompt copy-prompt":"icon-button"} aria-label={copied ? 'Copied' : prompt ? 'Copy prompt' : 'Copy response'} title={prompt?"Copy prompt":"Copy"} onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <Check size={15} /> : <Copy size={15} />}{prompt&&<span>{copied?'Copied':'Copy'}</span>}</button>;
}
function App() {
  const [health, setHealth] = useState(null);
  const [modelsOpen,setModelsOpen]=useState(false);
  const refreshHealth=()=>fetch('/api/health').then(r=>r.json()).then(setHealth).catch(()=>setHealth(null));
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef(null);
  const [mode, setMode] = useState('auto');
  const [modeMenu, setModeMenu] = useState(false);
  const [settings, setSettings] = useState(() => { try { return normalizeAudioSettings(normalizeImageSettings(normalizeVideoSettings({ ...initialSettings, ...JSON.parse(localStorage.getItem('wizgard-settings') || '{}') }))); } catch { return initialSettings; } });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebar, setSidebar] = useState(() => window.innerWidth > 760);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('chat');
  const [submitting,setSubmitting]=useState(false),[controlling,setControlling]=useState(false);
  const [legacyRetry,setLegacyRetry]=useState(null);
  const [streams,setStreams]=useState({});
  const [resourcesVisible,setResourcesVisible]=useState(()=>localStorage.getItem('wizgard-resources')==='true');
  const subscriptions=useRef(new Map());
  const jobs=health?.jobs||[];
  function openConversation(id){setSelected(id);setView('chat');setError('');fetch('/api/conversations').then(r=>r.json()).then(setConversations).catch(()=>{});}
  const notifications=useGenerationNotifications(health?.recentJobs,openConversation);
  const currentJob=jobs.find(j=>j.conversationId===selected);
  const stream=streams[selected];
  const busy=submitting||!!currentJob||!!stream?.pending;
  const streaming=stream?.live;
  const status=currentJob?.state==='paused'?'Paused — generation stays in memory.':currentJob?.sharedPause?'Waiting for the paused chat engine.':currentJob?.state==='queued'?(currentJob.status||'Waiting for an engine…'):stream?.status||currentJob?.status||'';
  const progress=stream?.progress??currentJob?.progress??null;
  useEffect(()=>{localStorage.setItem('wizgard-resources',String(resourcesVisible));},[resourcesVisible]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');
  const chatScroll=useRef(null),followLatest=useRef(true),scrollPositions=useRef(new Map());
  const [awayFromLatest,setAwayFromLatest]=useState(false);
  const input = useRef(null);
  const searchInput = useRef(null);
  const current = conversations.find(c => c.id === selected);
  const images = conversations.flatMap(c => c.messages.filter(m => m.imageUrl || m.videoUrl).map(m => ({ ...m, conversationId: c.id })));
  const selectedImageOptions = imageOptions[settings.imageModel] || imageOptions.qwen;
  const selectedImage = modelDisplayName(selectedImageOptions);
  const selectedVideoOptions = videoOptions[settings.videoModel] || videoOptions.ltx25;
  const selectedVideo = modelDisplayName(selectedVideoOptions);
  const manager=health?.modelManager;
  const modelInstalling=manager?.operating||['running','cancelling'].includes(manager?.job?.status);
  const activeModes=manager?.active||[];
  const ready=activeModes.length>0&&!modelInstalling;
  useEffect(()=>{const choices=health?.videoModels;if(!choices||choices.some(m=>m.id===settings.videoModel&&m.available&&m.active))return;const fallback=choices.find(m=>m.available&&m.active);if(fallback)setSettings(s=>switchVideoSettings(s,fallback.id));},[health?.videoModels,settings.videoModel]);
  useEffect(()=>{const choices=manager?.models;if(!choices||choices.some(m=>m.id===selectedImageOptions.managerId&&m.active))return;const fallback=choices.find(m=>m.capability==='image'&&m.active);const id=Object.keys(imageOptions).find(k=>imageOptions[k].managerId===fallback?.id);if(id)setSettings(s=>switchImageSettings(s,id));},[manager?.models,selectedImageOptions.managerId]);
  useEffect(()=>{if(mode!=='auto'&&!activeModes.includes(mode))setMode('auto');},[activeModes.join(',')]);
  const ModeIcon = modeIcons[mode];
  useEffect(() => {
    const refresh = () => fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth(null));
    refresh();
    fetch('/api/conversations').then(r => r.json()).then(setConversations).catch(() => setError('Could not load conversations.'));
    const timer = setInterval(refresh, 1200);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { localStorage.setItem('wizgard-settings', JSON.stringify(settings)); }, [settings]);
  function jumpToLatest(){followLatest.current=true;setAwayFromLatest(false);const panel=chatScroll.current;if(panel)panel.scrollTop=selected?panel.scrollHeight:0;}
  function trackScroll(){const panel=chatScroll.current;if(!panel)return;const atBottom=panel.scrollHeight-panel.scrollTop-panel.clientHeight<16;followLatest.current=atBottom;setAwayFromLatest(!atBottom);scrollPositions.current.set(selected,{top:panel.scrollTop,follow:atBottom});}
  useLayoutEffect(()=>{const panel=chatScroll.current;if(!panel)return;const saved=scrollPositions.current.get(selected);followLatest.current=saved?.follow??true;panel.scrollTop=!selected?0:followLatest.current?panel.scrollHeight:saved.top;setAwayFromLatest(!followLatest.current);},[selected,view]);
  useLayoutEffect(()=>{if(selected&&followLatest.current&&chatScroll.current)chatScroll.current.scrollTop=chatScroll.current.scrollHeight;},[current?.messages.length,streaming?.content,streaming?.thinking,status]);
  useEffect(() => {
    const key = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSidebar(true); setTimeout(() => searchInput.current?.focus(), 20); }
      if (event.key === 'Escape') { setLegacyRetry(null);setModelsOpen(false); setSettingsOpen(false); setModeMenu(false); setLightbox(null); if (!clearing) setClearOpen(false); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [clearing]);
  function updateConversation(c) { setConversations(old => [c, ...old.filter(item => item.id !== c.id)]); }
  async function clearWorkspace() {
    if (busy || jobs.length || clearing) return;
    setClearing(true); setClearError('');
    try {
      const response = await fetch('/api/workspace/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE_ALL_WORKSPACE_DATA' }) });
      if (!response.ok) throw new Error((await response.json()).error);
      setConversations([]); setAttachments([]); setSelected(null); setStreams({}); setLightbox(null); setText(''); setSearch(''); setError(''); setView('chat'); setSettingsOpen(false); setClearOpen(false);
      setNotice('Workspace cleared. Your models and settings are ready for a fresh start.');
    } catch (err) { setClearError(err.message); }
    finally { setClearing(false); }
  }
  function newChat() { if (submitting || uploading) return; setAttachments([]); setSelected(null); setView('chat'); setText(''); setError(''); setNotice(''); setTimeout(() => input.current?.focus(), 20); }
  async function removeConversation(event, id) {
    event.stopPropagation(); const response = await fetch('/api/conversations/' + id, { method: 'DELETE' });
    if (!response.ok) { setError((await response.json()).error); return; }
    setConversations(old => old.filter(c => c.id !== id)); if (selected === id) setSelected(null);
  }
  async function attachFiles(files) {
    if (busy || uploading) return;
    const selectedFiles = Array.from(files || []); if (!selectedFiles.length) return;
    if (attachments.length + selectedFiles.length > 10) { setError('You can attach up to 10 files per message.'); return; }
    if (selectedFiles.some(f => f.size > 20 * 1024 * 1024) || selectedFiles.reduce((n,f) => n + f.size, 0) > 100 * 1024 * 1024) { setError('Use files up to 20 MB each, 100 MB per upload.'); return; }
    setUploading(true); setError('');
    try {
      const form = new FormData(); selectedFiles.forEach(file => form.append('files', file));
      const response = await fetch('/api/attachments', { method: 'POST', body: form });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setAttachments(old => [...old, ...result]);
      const warnings = result.filter(f => f.warning).map(f => f.name + ': ' + f.warning); if (warnings.length) setNotice(warnings.join(' '));
    } catch (err) { setError(err.message); } finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function useImage(m, targetMode) {
    const response = await fetch(m.imageUrl), blob = await response.blob();
    await attachFiles([new File([blob], 'Wizgard-reference.png', { type: 'image/png' })]);
    setView('chat'); setMode(targetMode); input.current?.focus();
  }
  function subscribeJob(job) {
    if(subscriptions.current.has(job.id))return;
    const source=new EventSource('/api/jobs/'+job.id+'/events');source.conversationId=job.conversationId;subscriptions.current.set(job.id,source);
    let live={id:'streaming',role:'assistant',content:'',thinking:''},finished=false;
    const update=patch=>setStreams(old=>({...old,[job.conversationId]:{...old[job.conversationId],pending:true,...patch}}));
    update({live,status:'Waiting for a local engine…'});
    const finish=()=>{finished=true;source.close();subscriptions.current.delete(job.id);setStreams(old=>{const next={...old};delete next[job.conversationId];return next;});refreshHealth();};
    for(const event of ['conversation','status','notice','route','token','thinking','sources','image','video','audio','done','error','end'])source.addEventListener(event,e=>{
      if(!('data' in e))return;
      const data=JSON.parse(e.data);
      if(event==='conversation'){updateConversation(data.conversation);}
      if(event==='status')update({status:data.text,progress:data.progress??null});
      if(event==='notice')update({notice:data.text});
      if(event==='route'){live={...live,kind:data.route,model:data.model};update({live:{...live}});}
      if(event==='token'){live.content+=data.text;update({live:{...live},status:''});}
      if(event==='thinking'){live.thinking+=data.text;update({live:{...live},status:'Thinking…'});}
      if(event==='sources'){live.sources=data.sources;update({live:{...live}});}
      if(['image','video','audio'].includes(event)){Object.assign(live,data);update({live:{...live}});}
      if(event==='done'||event==='error'){if(data.conversation)updateConversation(data.conversation);finish();}
      if(event==='end')finish();
    });
    source.onerror=()=>{if(finished)return;source.close();subscriptions.current.delete(job.id);fetch('/api/conversations').then(r=>r.json()).then(setConversations).catch(()=>{});refreshHealth();};
  }
  useEffect(()=>{
    if(!health)return;
    for(const job of jobs)subscribeJob(job);
    const activeConversations=new Set(jobs.map(j=>j.conversationId));
    setStreams(old=>{
      const stale=Object.keys(old).filter(id=>!activeConversations.has(id)&&!submitting);
      if(!stale.length)return old;
      // Keep an open event stream until its final event, even if polling finishes first.
      const next={...old};let changed=false;
      for(const id of stale)if(![...subscriptions.current.values()].some(s=>s.conversationId===id)){delete next[id];changed=true;}
      return changed?next:old;
    });
  },[health]);
  useEffect(()=>()=>{for(const source of subscriptions.current.values())source.close();subscriptions.current.clear();},[]);
  async function generateVariation(variationId,prompt){
    const response=await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({variationId,prompt})});
    const result=await response.json();if(!response.ok)throw new Error(result.error);
    updateConversation(result.conversation);setSelected(result.conversation.id);setView('chat');setError('');setNotice('Variation queued with a fresh random seed.');subscribeJob({id:result.id,conversationId:result.conversation.id});refreshHealth();
  }
  async function retryPrompt(message,useCurrent=false){
    if(busy||uploading||!ready)return;
    if(!message.request&&!useCurrent){setLegacyRetry(message);return;}
    setLegacyRetry(null);jumpToLatest();setSubmitting(true);setError('');setNotice('');setView('chat');
    const body=message.request?{conversationId:selected,retryMessageId:message.id}:{conversationId:selected,prompt:message.content,mode,settings,attachmentIds:(message.attachments||[]).map(f=>f.id)};
    try{
      const response=await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      updateConversation(result.conversation);subscribeJob({id:result.id,conversationId:result.conversation.id});refreshHealth();
    }catch(e){setError(e.message);}finally{setSubmitting(false);}
  }
  async function send(event) {
    event?.preventDefault();
    if ((!text.trim() && !attachments.length) || busy || uploading || !ready) return;
    const prompt=text.trim()||(mode==='image'?'Create an image using these references.':mode==='video'?'Animate these images into a video.':'Describe and summarize the attached files.');
    jumpToLatest();setSubmitting(true);setError('');setNotice('');setView('chat');
    try {
      const response=await fetch('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({conversationId:selected,prompt,mode,settings,attachmentIds:attachments.map(f=>f.id)})});
      const result=await response.json();if(!response.ok)throw new Error(result.error);
      setText('');setAttachments([]);updateConversation(result.conversation);setSelected(result.conversation.id);
      subscribeJob({id:result.id,conversationId:result.conversation.id});refreshHealth();
    } catch(e){setError(e.message);}finally{setSubmitting(false);}
  }
  async function controlJob(action){
    const job=currentJob;if(!job||controlling)return;setControlling(true);
    try{const response=await fetch('/api/jobs/'+job.id+'/'+action,{method:'POST'});const data=await response.json();if(!response.ok)throw new Error(data.error);setHealth(old=>({...old,jobs:data}));}
    catch(e){setError(e.message);}finally{setControlling(false);}
  }
  async function stop(){await controlJob('stop');}
  function message(m) {
    return <article key={m.id} className={'message ' + m.role}>
      {m.role === 'assistant' && <Mark small />}
      <div className="message-body">
        {m.role === 'assistant' && <div className="message-label">Wizgard <span>{m.model || 'Local assistant'}</span></div>}
        {m.thinking && <details className="thinking"><summary>Thought process <ChevronDown size={13}/></summary><div>{m.thinking}</div></details>}
        {m.attachments?.length > 0 && <MessageAttachments files={m.attachments}/>}
        {m.content && <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ src, alt }) => src?.startsWith('/generated/') ? <img src={src} alt={alt || ''}/> : <span>{alt || 'Image reference'}</span> }}>{m.content}</ReactMarkdown></div>}
        {m.imageUrl && <figure className="image-result"><button className="image-preview" onClick={() => setLightbox(m)} aria-label="View generated image"><img src={m.imageUrl} alt={m.imagePrompt || 'Generated image'} /></button><figcaption><span>{m.width} × {m.height} <i>·</i> {m.steps} steps <i>·</i> Seed {m.seed}</span><a href={m.imageUrl} download={'Wizgard-' + m.seed + '.png'} title="Download image" aria-label="Download image"><Download size={16}/></a></figcaption><div className="reference-actions"><button disabled={busy || uploading || !activeModes.includes('image')} onClick={() => useImage(m, 'image')}>Use as image reference</button><button disabled={busy || uploading || !activeModes.includes('video')} onClick={() => useImage(m, 'video')}>Animate image</button></div><details><summary>Image prompt</summary><p>{m.imagePrompt}</p></details></figure>}
        {m.videoUrl && <figure className="image-result video-result"><video controls preload="metadata" playsInline src={m.videoUrl}/><figcaption><span>{m.width} × {m.height} · {m.seconds}s · {m.audio ? 'With audio' : 'Silent'}</span><a href={m.videoUrl} download={'Wizgard-' + m.seed + '.mp4'} aria-label="Download video"><Download size={16}/></a></figcaption><details><summary>Video prompt</summary><p>{m.videoPrompt}</p></details></figure>}
        {m.audioUrl && <figure className="audio-result"><div className="audio-result-header"><AudioLines size={21}/><strong>{modeLabels[m.audioKind] || 'Audio'}</strong><span>{m.model}</span></div><audio controls preload="metadata" src={m.audioUrl}/><figcaption><span>{Number(m.seconds).toFixed(1)} seconds · {m.sampleRate/1000} kHz</span><a href={m.audioUrl+'?download=1'} download aria-label="Download audio"><Download size={16}/></a></figcaption><details><summary>{m.transcript?'Spoken text':'Audio prompt'}</summary><p>{m.transcript||m.audioPrompt}</p></details></figure>}
        {m.sources?.length > 0 && <details className="sources"><summary>Sources ({m.sources.length})</summary>{m.sources.map((source,i) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{i+1}. {source.title || source.url}<small>{source.read ? 'Page read' : 'Search result'}</small></a>)}</details>}
        {m.role==='user'&&<div className="prompt-actions"><CopyButton value={m.content} prompt/>{!busy&&<button type="button" className="retry-prompt" disabled={uploading||!ready} title={m.request?'Retry with the original prompt, attachments and settings':'Retry this older prompt · original settings unavailable'} aria-label="Retry prompt" onClick={()=>retryPrompt(m)}><RotateCcw size={14}/>Retry</button>}</div>}
        {m.error && <div className={'inline-error ' + (m.cancelled ? 'cancelled' : '')}>{m.error}</div>}
        {m.role === 'assistant' && m.id !== 'streaming' && (m.content || m.imageUrl) && <div className="message-actions"><CopyButton value={m.imagePrompt || m.content}/>{m.metrics && <span>{m.metrics.seconds}s · {m.metrics.tokens} tokens</span>}</div>}
      </div>
    </article>;
  }
  if(manager?.setupRequired) return <ModelManagerView setup state={manager} output={health.output} onRefresh={refreshHealth}/>;
  return <div className={'app ' + (!sidebar ? 'sidebar-hidden' : '')}>
    <aside className="sidebar">
      <div className="brand-row"><Mark small/><strong>Wizgard</strong><button className="icon-button" title="Hide sidebar" aria-label="Hide sidebar" onClick={() => setSidebar(false)}><PanelLeftClose size={17}/></button></div>
      <button className="new-chat" onClick={newChat} disabled={submitting || uploading}><Plus size={17}/> New conversation <span>↗</span></button>
      <div className="search"><Search size={15}/><input ref={searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations" aria-label="Search conversations"/><kbd>⌃ K</kbd></div>
      <button className={'nav-item ' + (view === 'library' ? 'active' : '')} onClick={() => setView('library')}><Grid2X2 size={16}/> Generated Library</button>
      <button className={"nav-item "+(view==='queue'?'active':'')} onClick={()=>setView('queue')}><ListOrdered size={16}/>Generation Queue<span>{jobs.length||''}</span></button>
      <div className="history-title">CONVERSATIONS <span>{conversations.length}</span></div>
      <div className="history">
        {!conversations.length && <div className="empty-history">A fresh page for your ideas.<br/>Your conversations will appear here.</div>}
        {conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase())).map(c => <div className={'conversation-item ' + (selected === c.id && view === 'chat' ? 'active' : '')} key={c.id}><button onClick={() => { if (!submitting && !uploading) { setSelected(c.id); setView('chat'); setAttachments([]);setText('');setError('');setNotice(''); } }} title={c.title}><MessageSquare size={14}/><span>{c.title}</span>{jobs.some(j=>j.conversationId===c.id)&&<i className={"job-dot "+jobs.find(j=>j.conversationId===c.id).state} title={jobs.find(j=>j.conversationId===c.id).state}/>}</button><button className="delete-chat" onClick={e => removeConversation(e, c.id)} aria-label={'Delete ' + c.title} title="Delete conversation" disabled={jobs.some(j=>j.conversationId===c.id)}><Trash2 size={13}/></button></div>)}
      </div>
      <div className="sidebar-bottom">
        <div className="local-card"><span className={'status-dot ' + (ready ? 'online' : '')}/><div><strong>{ready ? 'All yours. All local.' : health?.runtime.error ? 'Setup needs attention' : 'Starting local models'}</strong><p>{ready ? settings.web ? 'Web access enabled.' : 'Web access is off.' : 'Check model settings for details.'}</p></div></div>
        <button className="nav-item manage-models-button" onClick={() => setModelsOpen(true)}><Settings size={17}/> Manage Models {modelInstalling && <LoaderCircle size={14} className="spin"/>}</button>
        <button className={"nav-item "+(resourcesVisible?"active":"")} aria-label="Toggle resource usage" aria-pressed={resourcesVisible} onClick={()=>setResourcesVisible(v=>!v)}><Activity size={16}/> Resource Usage</button>
        <button className="nav-item settings-link" onClick={() => setSettingsOpen(true)}><Settings2 size={16}/> Settings <span>⌘</span></button>
        <button className="nav-item clear-workspace" disabled={busy || uploading || clearing || !!health?.busy} onClick={() => { setClearError(''); setClearOpen(true); }}><Trash2 size={16}/> Clear Workspace</button>
        <div className="profile"><span className="avatar" role="img" aria-label="AI workspace"><Bot size={19} strokeWidth={1.7} aria-hidden="true"/></span><div><strong>Your workspace</strong><span>On this computer</span></div><span className="local-badge">LOCAL</span></div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div>{!sidebar && <button className="icon-button" title="Show sidebar" aria-label="Show sidebar" onClick={() => setSidebar(true)}><PanelLeftOpen size={18}/></button>}<span className="breadcrumb">Workspace</span><span className="slash">/</span><strong>{view === 'library' ? 'Generated Library' : view==='queue'?'Generation Queue': current?.title || 'New conversation'}</strong></div><div className="topbar-right"><span className="model-count"><span className={'status-dot ' + (ready ? 'online' : '')}/>{manager?.models.filter(m=>m.active).length||0} active models</span><button className="icon-button" title="Model settings" aria-label="Model settings" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={17}/></button></div></header>
      {view === 'library' ? <GeneratedLibraryView refreshKey={JSON.stringify(health?.recentJobs?.map(j=>j.id)||[])} onVariation={generateVariation}/>:view==='queue'?<GenerationQueue jobs={jobs} onUpdate={jobs=>setHealth(old=>({...old,jobs}))} onOpen={openConversation}/>
      : <><div className="chat-scene"><MatrixBackground/><div ref={chatScroll} tabIndex={0} role="region" aria-label="Conversation messages" onScroll={trackScroll} onLoadCapture={()=>{if(followLatest.current)jumpToLatest();}} className={'chat-scroll ' + (!current && !streaming ? 'is-empty' : '')}>
        {!current && !streaming ? <section className="welcome"><div className="welcome-symbol"><img src="/wizgard-icon.png" alt="Wizgard emblem" width="70" height="70"/></div><div className="section-kicker">YOUR SPACE TO THINK & CREATE</div><h1>A little magic.<br/><span>Entirely yours.</span></h1><p>Bring your ideas to life with your local models.<br/>One workspace. Yours to create in.</p><div className="suggestions">{examples.filter(e=>activeModes.includes(e.mode)).slice(0,3).map(({ icon: Icon, label, text: prompt }) => <button key={label} onClick={() => { setText(prompt); setMode('auto'); input.current?.focus(); }}><Icon size={19}/><span>{label}</span><ArrowUpRight size={15}/></button>)}</div><div className="powered">{manager?.models.filter(m=>m.active && (m.capability!=='video'||m.id===selectedVideoOptions.managerId) && (m.capability!=='image'||m.id===selectedImageOptions.managerId)).map(m=><span key={m.id}>{modelDisplayName(m)}<small>{modeLabels[m.capability||m.id]}</small></span>)}</div>{!activeModes.length&&<div className="no-models-hint">Enable a model to begin.<button onClick={()=>setModelsOpen(true)}>Manage Models</button></div>}</section>
        : <div className="messages">{current?.messages.filter(m=>!streaming||m.id!==streaming.id).map(message)}{streaming && message(streaming)}{busy && status && <div className="generation-status"><LoaderCircle size={15} className={currentJob?.state==='paused'?'':'spin'}/><span>{status}</span>{progress !== null && <><span>{progress}%</span><div className="progress-bar"><i style={{ width: progress + '%' }}/></div></>}</div>}</div>}
      </div></div><div className="composer-area">{selected&&awayFromLatest&&<button className="jump-latest" onClick={jumpToLatest}><ArrowDown size={14}/>Jump to latest</button>}
        {!ready && <div className="runtime-banner">{modelInstalling ? manager.job?.message || 'Updating active models…' : health ? 'Activate a model to begin.' : 'Connecting to Wizgard…'}<button onClick={() => setModelsOpen(true)}>Manage Models</button></div>}
        {jobs.some(j=>j.conversationId!==selected)&&<div className="parallel-notice">Another conversation is processing or waiting. Responses may take longer. This chat model processes one response at a time; queued conversations start automatically when the engine is free.</div>}
        {currentJob?.state==='paused'&&<div className="parallel-notice">Paused in memory. Resume continues the same generation. Shared chat work and queued media may wait; closing Wizgard ends the paused job.</div>}
        {(notice||stream?.notice) && <div className="notice">{notice||stream.notice}</div>}
        {error && <div className="error-banner">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={14}/></button></div>}
        <form className={'composer ' + (busy ? 'working' : '')} onSubmit={send} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void attachFiles(e.dataTransfer.files); }}>
          <input ref={fileInput} type="file" multiple hidden accept=".pdf,.docx,.txt,.md,.csv,.json,.log,.js,.jsx,.ts,.tsx,.py,.html,.css,.xml,.yaml,.yml,.sql,.sh,.ini,.png,.jpg,.jpeg,.webp" onChange={e => attachFiles(e.target.files)}/>
          {attachments.length > 0 && <ComposerAttachments files={attachments} disabled={busy || uploading} onRemove={id=>setAttachments(old=>old.filter(file=>file.id!==id))}/>}
          {attachments.some(f => f.kind === 'image') && <div className="attachment-hint">{mode === 'video' ? 'Video: use an opening image. LTX-2.5 accepts one image; Sulphur 2 accepts up to 10 guides.' : mode === 'image' ? 'Images are visual references. Describe what to preserve or change.' : 'Images can be analyzed in chat or used as generation references.'}</div>}
          <textarea ref={input} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} placeholder={mode === 'video' ? 'Describe the motion, scene and sound…' : mode === 'image' ? 'Describe the image you have in mind…' : mode==='speech'?'Enter text to speak or describe a voiceover…':mode==='music'?'Describe a song, instruments, mood or lyrics…':mode==='sfx'?'Describe the sound you want to hear…':'Ask anything, or describe what you want to create…'} aria-label="Message Wizgard" rows={2} maxLength={16000} disabled={busy}/>
          <div className="composer-controls"><div className="composer-left"><button type="button" className="icon-button" disabled={busy || uploading || attachments.length >= 10} title="Attach files (up to 10)" aria-label="Attach files" onClick={() => fileInput.current?.click()}>{uploading ? <LoaderCircle className="spin" size={17}/> : <Paperclip size={17}/>}</button><button type="button" className={'icon-button web-toggle ' + (settings.web ? 'enabled' : '')} aria-label="Web access" aria-pressed={settings.web} title={settings.web ? 'Web access on' : 'Web access off'} disabled={busy || !activeModes.includes('chat')} onClick={() => setSettings(s => ({ ...s, web: !s.web }))}><Globe size={17}/></button><div className="mode-wrap"><button type="button" className={'mode-button ' + (mode === 'image' ? 'image-mode' : '')} onClick={() => setModeMenu(!modeMenu)} disabled={busy}><ModeIcon size={15}/>{modeLabels[mode]}<ChevronDown size={13}/></button>{modeMenu && <div className="mode-menu">{[['auto', 'Let Wizgard choose the right model'], ['chat', 'Talk with Qwen 3.8'], ['image', 'Create with ' + selectedImage], ['video', 'Create clips with ' + selectedVideo],['speech','Speak with Qwen3-TTS'],['music','Compose with ACE-Step'],['sfx','Create with MOSS SoundEffect']].filter(([key])=>key==='auto'||activeModes.includes(key)).map(([key, label]) => { const Icon = modeIcons[key]; return <button key={key} type="button" onClick={() => { setMode(key); setModeMenu(false); }}><Icon size={17}/><div><strong>{modeLabels[key]}</strong><span>{label}</span></div>{key === mode && <Check size={14}/>}</button>; })}</div>}</div><button type="button" className="composer-settings" title="Generation settings" aria-label="Generation settings" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={15}/><span>{mode === 'image' ? settings.width + ' × ' + settings.height : settings.thinking ? 'Thinking on' : 'Local models'}</span></button></div>{busy ? <div className="generation-buttons"><button type="button" className="pause-button" title={currentJob?.state==='paused'?'Resume generation':'Pause in memory'} aria-label={currentJob?.state==='paused'?'Resume generation':'Pause generation'} disabled={!currentJob||controlling||!!currentJob.sharedPause} onClick={()=>controlJob(currentJob.state==='paused'?'resume':'pause')}>{currentJob?.state==='paused'?<Play size={16}/>:<Pause size={16}/>}</button><button type="button" className="send-button stop" title="Stop generation" aria-label="Stop generation" disabled={!currentJob||controlling} onClick={stop}><Square size={15} fill="currentColor"/></button></div> : <button className="send-button" type="submit" disabled={(!text.trim() && !attachments.length) || !ready || uploading} title="Send message" aria-label="Send message"><ArrowUp size={20}/></button>}</div>
        </form><div className="composer-footnote"><span className="tiny-lock"><HardDrive size={11}/> Your conversations stay on this computer.</span><span>Enter to send <i>·</i> Shift + Enter for a new line</span></div>
      </div></>}
      <footer className="app-credit"><div>An AI Tool developed by <a href="https://karmikalapps.com/" target="_blank" rel="noopener noreferrer"><strong>Karmikal Apps</strong></a> &copy; 2026</div><div className="app-version">{appInfo.version}</div></footer>
      {resourcesVisible&&<ResourceBar onClose={()=>setResourcesVisible(false)}/>}
    </main>
    {legacyRetry&&<div className="modal-backdrop clear-backdrop" onClick={()=>setLegacyRetry(null)}><section className="clear-modal" role="dialog" aria-modal="true" aria-labelledby="retry-title" onClick={e=>e.stopPropagation()}><h2 id="retry-title">Retry an older prompt</h2><p>This prompt was sent before settings were saved. Its text and attachments can be reused, but the original generation settings are unavailable.</p><p>Retry using your currently selected mode, models and settings?</p><div className="clear-actions"><button autoFocus className="cancel-button" onClick={()=>setLegacyRetry(null)}>Cancel</button><button className="primary-button" onClick={()=>retryPrompt(legacyRetry,true)}>Retry with current settings</button></div></section></div>}
    {clearOpen && <div className="modal-backdrop clear-backdrop" onClick={() => { if (!clearing) setClearOpen(false); }}><section className="clear-modal" role="dialog" aria-modal="true" aria-labelledby="clear-title" aria-describedby="clear-description" onClick={e => e.stopPropagation()}><div className="clear-icon"><Trash2 size={23}/></div><h2 id="clear-title">Clear Workspace</h2><p id="clear-description">Permanently delete all chats, attachments, generated images, videos and audio from this workspace, including configured output locations?</p><p>Your downloaded models, runtimes, and app settings will be kept. This cannot be undone.</p>{clearError && <p className="inline-error">{clearError}</p>}<div className="clear-actions"><button className="cancel-button" autoFocus disabled={clearing} onClick={() => setClearOpen(false)}>Cancel</button><button className="danger-button" disabled={clearing || busy} onClick={clearWorkspace}>{clearing ? 'Clearing…' : 'Clear Workspace'}</button></div></section></div>}
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><div className="section-kicker">MAKE IT YOURS</div><h2 id="settings-title">Workspace settings</h2></div><button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={20}/></button></div>{manager?.models.filter(m=>m.installed).map(m=>{const Icon=capabilityIcons[m.id];return <div className="model-setting" key={m.id}><Icon size={20}/><div><strong>{modelDisplayName(m)}</strong><p>{m.subtitle}</p></div><span className={'pill '+(m.active?'good':'')}>{m.active?'Active':'Inactive'}</span></div>;})}<p className="model-label-note">{modelLabelNote}</p><button className="subtle-button" onClick={()=>{setSettingsOpen(false);setModelsOpen(true);}}>Manage models & output location →</button>{health?.runtime.error && <p className="inline-error">{health.runtime.error}</p>}
      <div className="setting-row"><div><strong>Thinking mode</strong><p>Allow more reasoning before a chat answer.</p></div><button className={'toggle ' + (settings.thinking ? 'on' : '')} role="switch" aria-checked={settings.thinking} aria-label="Thinking mode" onClick={() => setSettings(s => ({ ...s, thinking: !s.thinking }))}><span/></button></div>
      <div className="setting-row"><div><strong>Web access</strong><p>Search and read public pages when useful. Queries go online; files stay local.</p></div><button className={'toggle ' + (settings.web ? 'on' : '')} role="switch" aria-checked={settings.web} aria-label="Enable web access" onClick={() => setSettings(s => ({ ...s, web: !s.web }))}><span/></button></div>
      <NotificationSettings controller={notifications}/>
      {activeModes.some(k=>['speech','music','sfx'].includes(k))&&<><h3>Audio generation</h3><div className="settings-grid">{activeModes.includes('speech')&&<><label>Voice<select value={settings.voice} onChange={e=>setSettings(s=>({...s,voice:e.target.value}))}>{['Ryan','Aiden','Vivian','Serena','Uncle_Fu','Dylan','Eric','Ono_Anna','Sohee'].map(v=><option key={v}>{v}</option>)}</select></label><label>Language<select value={settings.language} onChange={e=>setSettings(s=>({...s,language:e.target.value}))}>{['Auto','English','Chinese','Japanese','Korean','German','French','Russian','Portuguese','Spanish','Italian'].map(v=><option key={v}>{v}</option>)}</select></label><label>Voice style<input value={settings.voiceStyle} maxLength={1000} placeholder="Warm and expressive" onChange={e=>setSettings(s=>({...s,voiceStyle:e.target.value}))}/></label></>}{activeModes.includes('speech')&&<label>Speech duration<select value="auto" disabled><option value="auto">Auto · full spoken text</option></select></label>}{activeModes.includes('music')&&<label>Music duration (seconds)<input aria-label="Music duration in seconds" aria-describedby="music-duration-hint" type="number" min="5" max="180" step="1" value={settings.musicSeconds} onChange={e=>setSettings(s=>({...s,musicSeconds:e.target.value===''?'':Number(e.target.value)}))}/><small className="field-hint" id="music-duration-hint">Min 5 sec · Max 180 sec · Default 120 sec (2 minutes)</small></label>}{activeModes.includes('music')&&<label>Lyrics (optional)<textarea className="lyrics-input" value={settings.musicLyrics} maxLength={10000} rows={4} placeholder="[Verse]… Leave empty to follow the prompt" onChange={e=>setSettings(s=>({...s,musicLyrics:e.target.value}))}/></label>}{activeModes.includes('sfx')&&<label>Effects duration<select value={settings.sfxSeconds==='auto'?'auto':'custom'} onChange={e=>setSettings(s=>({...s,sfxSeconds:e.target.value==='auto'?'auto':10}))}><option value="auto">Auto · fit description</option><option value="custom">Custom duration</option></select>{settings.sfxSeconds!=='auto'&&<input aria-label="Effects duration in seconds" type="number" min="1" max="30" value={settings.sfxSeconds} onChange={e=>setSettings(s=>({...s,sfxSeconds:Number(e.target.value)}))}/>}</label>}</div><p className="settings-note">Speech runs for the full spoken text. Music uses the duration above. Auto for sound effects estimates timing from the description, up to 30 seconds. A duration in your prompt overrides these settings within the supported limits.</p></>}
      {activeModes.includes('video')&&<><h3>Video generation</h3><fieldset className="video-model-picker" disabled={busy || modelInstalling}><legend>Video model</legend><div>{Object.entries(videoOptions).map(([id,model])=>{const installed=health?.videoModels?.find(m=>m.id===id);const available=installed?.available && installed?.active;return <label key={id} className={(settings.videoModel===id?'selected ':'')+(!available?'unavailable':'')}><input type="radio" name="video-model" value={id} checked={settings.videoModel===id} disabled={!available} onChange={()=>setSettings(s=>switchVideoSettings(s,id))}/><span><strong>{modelDisplayName(model)}</strong><small>{available?(id==='ltx25'?'Up to 1080p · optional sound':'24 fps · optional sound'):installed?.available?'Inactive':'Not installed'}</small></span></label>;})}</div></fieldset>
      <div className="settings-grid"><label>Video resolution<select value={settings.videoWidth+'x'+settings.videoHeight} onChange={e=>{const [videoWidth,videoHeight]=e.target.value.split('x').map(Number);setSettings(s=>({...s,videoWidth,videoHeight}));}}>{selectedVideoOptions.sizes.map(s=><option key={s.width+'x'+s.height} value={s.width+'x'+s.height}>{s.label}</option>)}</select></label><label>Frame rate<select value={settings.videoFps} onChange={e=>setSettings(s=>({...s,videoFps:Number(e.target.value)}))}>{selectedVideoOptions.frameRates.map(fps=><option key={fps} value={fps}>{fps} fps</option>)}</select></label><label>Duration<select value={settings.videoSeconds} onChange={e=>setSettings(s=>({...s,videoSeconds:Number(e.target.value)}))}>{selectedVideoOptions.durations.map(n=><option key={n} value={n}>{n} seconds</option>)}</select></label><label>Sound<select value={settings.videoAudio?'on':'off'} onChange={e=>setSettings(s=>({...s,videoAudio:e.target.value==='on'}))}><option value="off">Silent video</option><option value="on">Generate with sound</option></select></label><label>Video seed <span>(-1 = random)</span><input type="number" min="-1" max="2147483647" value={settings.seed} onChange={e=>setSettings(s=>({...s,seed:Number(e.target.value)}))}/></label></div>
      <p className="settings-note">{selectedVideoOptions.description} Your settings are remembered separately for each model and apply to Auto video requests too. Output: {settings.videoWidth} × {settings.videoHeight}, {videoFrames(settings.videoSeconds,settings.videoFps)} frames (about {(videoFrames(settings.videoSeconds,settings.videoFps)/settings.videoFps).toFixed(2)} seconds).</p>{settings.videoWidth*settings.videoHeight>=1280*720&&<p className="settings-note">HD resolution, higher frame rates and longer clips need substantially more GPU memory and time. Start with a 2-second clip at 24 fps, or use Preview for a quicker test.</p>}
      </>}{activeModes.includes('image')&&<><h3>Image generation</h3><fieldset className="video-model-picker" disabled={busy || modelInstalling}><legend>Image model</legend><div>{Object.entries(imageOptions).map(([id,model])=>{const installed=manager?.models.find(m=>m.id===model.managerId);const available=installed?.installed&&installed?.active;return <label key={id} className={(settings.imageModel===id?'selected ':'')+(!available?'unavailable':'')}><input type="radio" name="image-model" value={id} checked={settings.imageModel===id} disabled={!available} onChange={()=>setSettings(s=>switchImageSettings(s,id))}/><span><strong>{modelDisplayName(model)}</strong><small>{available?(id==='flux2'?'32B dev · reference editing':'Q8 · reference editing'):installed?.installed?'Inactive':'Not installed'}</small></span></label>;})}</div></fieldset><p className="settings-note">{selectedImageOptions.description} Image settings are remembered separately for each model. Auto uses your selected image model.</p><div className="settings-grid"><label>Image size<select value={settings.width + 'x' + settings.height} onChange={e => { const [width, height] = e.target.value.split('x').map(Number); setSettings(s => ({ ...s, width, height })); }}>{[[512,512],[768,768],[1024,1024],[1536,1024],[1024,1536],[2048,2048]].map(([w,h]) => <option key={w+'x'+h} value={w+'x'+h}>{w} × {h}{w===1024&&h===1024 ? ' · Default' : ''}</option>)}</select></label><label>Steps<input type="number" min="1" max="60" value={settings.steps} onChange={e => setSettings(s => ({ ...s, steps: Number(e.target.value) }))}/></label><label>Seed <span>(-1 = random)</span><input type="number" min="-1" max="2147483647" value={settings.seed} onChange={e => setSettings(s => ({ ...s, seed: Number(e.target.value) }))}/></label>{settings.imageModel==='flux2'&&<label>Guidance<input type="number" min="1" max="10" step="0.1" value={settings.imageGuidance} onChange={e=>setSettings(s=>({...s,imageGuidance:Number(e.target.value)}))}/></label>}<label>Image runtime<select value={settings.backend} onChange={e => setSettings(s => ({ ...s, backend: e.target.value }))}><option value="auto">Auto · best available</option>{health?.engines.cuda && <option value="cuda">NVIDIA GPU · CUDA</option>}{health?.engines.metal && <option value="metal">Apple GPU · Metal</option>}{health?.engines.vulkan && <option value="vulkan">GPU · Vulkan</option>}<option value="cpu">CPU · much slower</option></select></label></div><p className="settings-note"><CircleHelp size={14}/> Models take turns using GPU memory. Native 2K images need more time and memory. Use the Run script for your operating system. GPU support depends on the hardware and drivers on that computer.</p></>}<div className="settings-footer"><span>Wizgard {appInfo.version} · Local workspace</span><button className="subtle-button" onClick={() => { setSettings(initialSettings); }}>Reset settings</button></div><button className="shutdown-button" onClick={async () => { if (jobs.length) { setError('Stop or finish every conversation before shutting down from Settings.'); return; } await fetch('/api/shutdown', { method: 'POST' }); setHealth(null); setSettingsOpen(false); setError('Wizgard is shut down. Use the Run script for your operating system to start it again.'); }}><Power size={14}/> Shut down local runtimes</button></section></div>}
    {modelsOpen && <ModelManagerView state={manager} output={health?.output} onRefresh={refreshHealth} onClose={()=>setModelsOpen(false)}/>}
    {lightbox && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Generated image" onClick={() => setLightbox(null)}><button className="lightbox-close" aria-label="Close image" onClick={() => setLightbox(null)}><X size={22}/></button><img src={lightbox.imageUrl} alt={lightbox.imagePrompt} onClick={e => e.stopPropagation()}/><a className="primary-button" href={lightbox.imageUrl} download={'Wizgard-'+lightbox.seed+'.png'} onClick={e => e.stopPropagation()}><Download size={16}/> Download image</a></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
