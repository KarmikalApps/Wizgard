import { ModelManagerView, capabilityIcons } from './Models';
import { GeneratedLibraryView } from './Library';
import './models.css';
import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Plus, Search, Settings, Settings2, ArrowUp, Square, Sparkles, Image, MessageSquare, ChevronDown, PanelLeftClose, PanelLeftOpen, Download, Copy, Check, Trash2, X, ArrowUpRight, Cpu, HardDrive, CircleHelp, Command, CheckCircle2, LoaderCircle, Power, SlidersHorizontal, Grid2X2, Film, Paperclip, Globe, FileText, Mic, Music2, AudioLines } from 'lucide-react';
import './styles.css';
import appInfo from '../app-info.json';

const initialSettings = { width: 1024, height: 1024, steps: 25, seed: -1, backend: 'auto', thinking: false, videoWidth: 512, videoHeight: 320, videoSeconds: 2, videoAudio: true, web: false, voice: 'Ryan', language: 'Auto', voiceStyle: '', musicLyrics: '', musicSeconds: 30, sfxSeconds: 10 };
const examples = [
  { mode:'chat', icon: Sparkles, label: 'Think something through', text: 'Help me think through a creative project I want to start.' },
  { mode:'image', icon: Image, label: 'Make something visual', text: 'Create an image of a tiny cabin inside a glass terrarium, warm evening light, botanical details, cinematic photography.' },
  { mode:'music', icon: Music2, label: 'Set the mood', text: 'Create 30 seconds of gentle piano music with a mystical atmosphere, no vocals.' },
  { mode:'speech', icon: Mic, label: 'Give words a voice', text: 'Say "Every great idea starts with a little imagination." in a warm, expressive voice.' },
  { mode:'video', icon: Film, label: 'Bring a scene to life', text: 'Create a video of a paper boat drifting across a moonlit pond.' },
  { mode:'sfx', icon: AudioLines, label: 'Imagine a sound', text: 'Generate 5 seconds of rain softly falling on forest leaves.' },
];
const modeLabels = { auto: 'Auto', chat: 'Chat', image: 'Image', video: 'Video', speech: 'Speech', music: 'Music', sfx: 'Sound Effects' };
const modeIcons = { auto: Sparkles, chat: MessageSquare, image: Image, video: Film, speech: Mic, music: Music2, sfx: AudioLines };
function Mark({ small = false }) { return <div className={'mark ' + (small ? 'small' : '')}><img src="/wizgard-icon.png" alt="" width={small ? 32 : 48} height={small ? 32 : 48} /></div>; }
function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return <button className="icon-button" aria-label={copied ? 'Copied' : 'Copy response'} title="Copy" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>;
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
  const [settings, setSettings] = useState(() => { try { return { ...initialSettings, ...JSON.parse(localStorage.getItem('wizgard-settings') || '{}') }; } catch { return initialSettings; } });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebar, setSidebar] = useState(() => window.innerWidth > 760);
  const [search, setSearch] = useState('');
  const [view, setView] = useState('chat');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(null);
  const [streaming, setStreaming] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState('');
  const bottom = useRef(null);
  const input = useRef(null);
  const searchInput = useRef(null);
  const abortRef = useRef(null);
  const current = conversations.find(c => c.id === selected);
  const images = conversations.flatMap(c => c.messages.filter(m => m.imageUrl || m.videoUrl).map(m => ({ ...m, conversationId: c.id })));
  const manager=health?.modelManager;
  const modelInstalling=manager?.operating||['running','cancelling'].includes(manager?.job?.status);
  const activeModes=manager?.active||[];
  const ready=activeModes.length>0&&!modelInstalling;
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
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [current?.messages.length, streaming?.content, streaming?.thinking, status]);
  useEffect(() => {
    const key = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSidebar(true); setTimeout(() => searchInput.current?.focus(), 20); }
      if (event.key === 'Escape') { setModelsOpen(false); setSettingsOpen(false); setModeMenu(false); setLightbox(null); if (!clearing) setClearOpen(false); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [clearing]);
  function updateConversation(c) { setConversations(old => [c, ...old.filter(item => item.id !== c.id)]); setSelected(c.id); }
  async function clearWorkspace() {
    if (busy || clearing) return;
    setClearing(true); setClearError('');
    try {
      const response = await fetch('/api/workspace/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE_ALL_WORKSPACE_DATA' }) });
      if (!response.ok) throw new Error((await response.json()).error);
      setConversations([]); setAttachments([]); setSelected(null); setStreaming(null); setLightbox(null); setText(''); setSearch(''); setError(''); setView('chat'); setSettingsOpen(false); setClearOpen(false);
      setNotice('Workspace cleared. Your models and settings are ready for a fresh start.');
    } catch (err) { setClearError(err.message); }
    finally { setClearing(false); }
  }
  function newChat() { if (busy || uploading) return; setAttachments([]); setSelected(null); setView('chat'); setText(''); setError(''); setNotice(''); setStreaming(null); setTimeout(() => input.current?.focus(), 20); }
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
  async function send(event) {
    event?.preventDefault();
    if ((!text.trim() && !attachments.length) || busy || uploading || !ready) return;
    const prompt = text.trim() || (mode === 'image' ? 'Create an image using these references.' : mode === 'video' ? 'Animate these images into a video.' : 'Describe and summarize the attached files.'); setText(''); setBusy(true); setError(''); setNotice(''); setStatus('Getting ready…'); setProgress(null); setView('chat');
    const controller = new AbortController(); abortRef.current = controller;
    let live = { id: 'streaming', role: 'assistant', content: '', thinking: '' };
    try {
      const response = await fetch('/api/message', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected, prompt, mode, settings, attachmentIds: attachments.map(f => f.id) }), signal: controller.signal });
      if (!response.ok) { setText(prompt); throw new Error((await response.json()).error); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      function consume(block) {
        const eventName = block.match(/^event: (.+)$/m)?.[1];
        const dataLine = block.split('\n').find(line => line.startsWith('data: ')); if (!dataLine) return;
        const data = JSON.parse(dataLine.slice(6));
        if (eventName === 'conversation') { setAttachments([]); updateConversation(data.conversation); setStreaming({ ...live }); }
        if (eventName === 'status') { setStatus(data.text); setProgress(data.progress ?? null); }
        if (eventName === 'notice') setNotice(data.text);
        if (eventName === 'route') { live = { ...live, kind: data.route, model: data.model }; setStreaming({ ...live }); }
        if (eventName === 'token') { live.content += data.text; setStreaming({ ...live }); setStatus(''); }
        if (eventName === 'thinking') { live.thinking += data.text; setStreaming({ ...live }); setStatus('Thinking…'); }
        if (eventName === 'sources') { live.sources = data.sources; setStreaming({ ...live }); }
        if (eventName === 'audio') { Object.assign(live,data); setStreaming({...live}); }
        if (eventName === 'video') { Object.assign(live, data, { content: 'Here’s your video.' }); setStreaming({ ...live }); }
        if (eventName === 'image') { Object.assign(live, data, { content: 'Here’s your image.' }); setStreaming({ ...live }); }
        if (eventName === 'done') { updateConversation(data.conversation); setStreaming(null); }
        if (eventName === 'error') { if (data.conversation) { updateConversation(data.conversation); setStreaming(null); } else setError(data.message); }
      }
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n'); buffer = blocks.pop(); for (const block of blocks) consume(block);
      }
      buffer += decoder.decode(); if (buffer.trim()) consume(buffer);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
      fetch('/api/conversations').then(r => r.json()).then(setConversations).catch(() => {});
      setStreaming(null);
    } finally { setBusy(false); setStatus(''); setProgress(null); abortRef.current = null; }
  }
  async function stop() { setStatus('Stopping…'); await fetch('/api/stop', { method: 'POST' }).catch(() => abortRef.current?.abort()); }
  function message(m) {
    return <article key={m.id} className={'message ' + m.role}>
      {m.role === 'assistant' && <Mark small />}
      <div className="message-body">
        {m.role === 'assistant' && <div className="message-label">Wizgard <span>{m.model || 'Local assistant'}</span></div>}
        {m.thinking && <details className="thinking"><summary>Thought process <ChevronDown size={13}/></summary><div>{m.thinking}</div></details>}
        {m.attachments?.length > 0 && <div className="message-attachments">{m.attachments.map(f => <a key={f.id} href={f.url} download={f.name} title={f.warning || f.name}>{f.kind === 'image' ? <img src={f.previewUrl} alt={f.name}/> : <FileText size={22}/>}<span>{f.name}</span></a>)}</div>}
        {m.content && <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ src, alt }) => src?.startsWith('/generated/') ? <img src={src} alt={alt || ''}/> : <span>{alt || 'Image reference'}</span> }}>{m.content}</ReactMarkdown></div>}
        {m.imageUrl && <figure className="image-result"><button className="image-preview" onClick={() => setLightbox(m)} aria-label="View generated image"><img src={m.imageUrl} alt={m.imagePrompt || 'Generated image'} /></button><figcaption><span>{m.width} × {m.height} <i>·</i> {m.steps} steps <i>·</i> Seed {m.seed}</span><a href={m.imageUrl} download={'Wizgard-' + m.seed + '.png'} title="Download image" aria-label="Download image"><Download size={16}/></a></figcaption><div className="reference-actions"><button disabled={busy || uploading || !activeModes.includes('image')} onClick={() => useImage(m, 'image')}>Use as image reference</button><button disabled={busy || uploading || !activeModes.includes('video')} onClick={() => useImage(m, 'video')}>Animate image</button></div><details><summary>Image prompt</summary><p>{m.imagePrompt}</p></details></figure>}
        {m.videoUrl && <figure className="image-result video-result"><video controls preload="metadata" playsInline src={m.videoUrl}/><figcaption><span>{m.width} × {m.height} · {m.seconds}s · {m.audio ? 'With audio' : 'Silent'}</span><a href={m.videoUrl} download={'Wizgard-' + m.seed + '.mp4'} aria-label="Download video"><Download size={16}/></a></figcaption><details><summary>Video prompt</summary><p>{m.videoPrompt}</p></details></figure>}
        {m.audioUrl && <figure className="audio-result"><div className="audio-result-header"><AudioLines size={21}/><strong>{modeLabels[m.audioKind] || 'Audio'}</strong><span>{m.model}</span></div><audio controls preload="metadata" src={m.audioUrl}/><figcaption><span>{Number(m.seconds).toFixed(1)} seconds · {m.sampleRate/1000} kHz</span><a href={m.audioUrl+'?download=1'} download aria-label="Download audio"><Download size={16}/></a></figcaption><details><summary>{m.transcript?'Spoken text':'Audio prompt'}</summary><p>{m.transcript||m.audioPrompt}</p></details></figure>}
        {m.sources?.length > 0 && <details className="sources"><summary>Sources ({m.sources.length})</summary>{m.sources.map((source,i) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{i+1}. {source.title || source.url}<small>{source.read ? 'Page read' : 'Search result'}</small></a>)}</details>}
        {m.error && <div className={'inline-error ' + (m.cancelled ? 'cancelled' : '')}>{m.error}</div>}
        {m.role === 'assistant' && m.id !== 'streaming' && (m.content || m.imageUrl) && <div className="message-actions"><CopyButton value={m.imagePrompt || m.content}/>{m.metrics && <span>{m.metrics.seconds}s · {m.metrics.tokens} tokens</span>}</div>}
      </div>
    </article>;
  }
  if(manager?.setupRequired) return <ModelManagerView setup state={manager} output={health.output} onRefresh={refreshHealth}/>;
  return <div className={'app ' + (!sidebar ? 'sidebar-hidden' : '')}>
    <aside className="sidebar">
      <div className="brand-row"><Mark small/><strong>Wizgard</strong><button className="icon-button" title="Hide sidebar" aria-label="Hide sidebar" onClick={() => setSidebar(false)}><PanelLeftClose size={17}/></button></div>
      <button className="new-chat" onClick={newChat} disabled={busy}><Plus size={17}/> New conversation <span>↗</span></button>
      <div className="search"><Search size={15}/><input ref={searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations" aria-label="Search conversations"/><kbd>⌃ K</kbd></div>
      <button className={'nav-item ' + (view === 'library' ? 'active' : '')} onClick={() => setView('library')}><Grid2X2 size={16}/> Generated Library</button>
      <div className="history-title">CONVERSATIONS <span>{conversations.length}</span></div>
      <div className="history">
        {!conversations.length && <div className="empty-history">A fresh page for your ideas.<br/>Your conversations will appear here.</div>}
        {conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase())).map(c => <div className={'conversation-item ' + (selected === c.id && view === 'chat' ? 'active' : '')} key={c.id}><button onClick={() => { if (!busy) { setSelected(c.id); setView('chat'); setError(''); } }} title={c.title}><MessageSquare size={14}/><span>{c.title}</span></button><button className="delete-chat" onClick={e => removeConversation(e, c.id)} aria-label={'Delete ' + c.title} title="Delete conversation" disabled={busy}><Trash2 size={13}/></button></div>)}
      </div>
      <div className="sidebar-bottom">
        <div className="local-card"><span className={'status-dot ' + (ready ? 'online' : '')}/><div><strong>{ready ? 'All yours. All local.' : health?.runtime.error ? 'Setup needs attention' : 'Starting local models'}</strong><p>{ready ? settings.web ? 'Web access enabled.' : 'Web access is off.' : 'Check model settings for details.'}</p></div></div>
        <button className="nav-item manage-models-button" onClick={() => setModelsOpen(true)}><Settings size={17}/> Manage Models {modelInstalling && <LoaderCircle size={14} className="spin"/>}</button>
        <button className="nav-item settings-link" onClick={() => setSettingsOpen(true)}><Settings2 size={16}/> Settings <span>⌘</span></button>
        <button className="nav-item clear-workspace" disabled={busy || uploading || clearing || !!health?.busy} onClick={() => { setClearError(''); setClearOpen(true); }}><Trash2 size={16}/> Clear Workspace</button>
        <div className="profile"><span className="avatar">Y</span><div><strong>Your workspace</strong><span>On this computer</span></div><span className="local-badge">LOCAL</span></div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div>{!sidebar && <button className="icon-button" title="Show sidebar" aria-label="Show sidebar" onClick={() => setSidebar(true)}><PanelLeftOpen size={18}/></button>}<span className="breadcrumb">Workspace</span><span className="slash">/</span><strong>{view === 'library' ? 'Generated Library' : current?.title || 'New conversation'}</strong></div><div className="topbar-right"><span className="model-count"><span className={'status-dot ' + (ready ? 'online' : '')}/>{activeModes.length} active models</span><button className="icon-button" title="Model settings" aria-label="Model settings" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={17}/></button></div></header>
      {view === 'library' ? <GeneratedLibraryView refreshKey={busy}/>
      : <><div className={'chat-scroll ' + (!current && !streaming ? 'is-empty' : '')}>
        {!current && !streaming ? <section className="welcome"><div className="welcome-symbol"><img src="/wizgard-icon.png" alt="Wizgard emblem" width="70" height="70"/></div><div className="section-kicker">YOUR SPACE TO THINK & CREATE</div><h1>A little magic.<br/><span>Entirely yours.</span></h1><p>Bring your ideas to life with your local models.<br/>One workspace. Yours to create in.</p><div className="suggestions">{examples.filter(e=>activeModes.includes(e.mode)).slice(0,3).map(({ icon: Icon, label, text: prompt }) => <button key={label} onClick={() => { setText(prompt); setMode('auto'); input.current?.focus(); }}><Icon size={19}/><span>{label}</span><ArrowUpRight size={15}/></button>)}</div><div className="powered">{manager?.models.filter(m=>m.active).map(m=><span key={m.id}>{m.name}<small>{modeLabels[m.id]}</small></span>)}</div>{!activeModes.length&&<div className="no-models-hint">Enable a model to begin.<button onClick={()=>setModelsOpen(true)}>Manage Models</button></div>}</section>
        : <div className="messages">{current?.messages.map(message)}{streaming && message(streaming)}{busy && status && <div className="generation-status"><LoaderCircle size={15} className="spin"/><span>{status}</span>{progress !== null && <><span>{progress}%</span><div className="progress-bar"><i style={{ width: progress + '%' }}/></div></>}</div>}<div ref={bottom}/></div>}
      </div><div className="composer-area">
        {!ready && <div className="runtime-banner">{modelInstalling ? manager.job?.message || 'Updating active models…' : health ? 'Activate a model to begin.' : 'Connecting to Wizgard…'}<button onClick={() => setModelsOpen(true)}>Manage Models</button></div>}
        {notice && <div className="notice">{notice}</div>}
        {error && <div className="error-banner">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={14}/></button></div>}
        <form className={'composer ' + (busy ? 'working' : '')} onSubmit={send} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); void attachFiles(e.dataTransfer.files); }}>
          <input ref={fileInput} type="file" multiple hidden accept=".pdf,.docx,.txt,.md,.csv,.json,.log,.js,.jsx,.ts,.tsx,.py,.html,.css,.xml,.yaml,.yml,.sql,.sh,.ini,.png,.jpg,.jpeg,.webp" onChange={e => attachFiles(e.target.files)}/>
          {attachments.length > 0 && <div className="attachment-tray">{attachments.map((f,i) => <div className="attachment-chip" key={f.id}>{f.kind === 'image' ? <img src={f.previewUrl} alt=""/> : <FileText size={18}/>}<span title={f.name}>{i+1}. {f.name}</span><button type="button" disabled={busy || uploading} onClick={() => setAttachments(old => old.filter(a => a.id !== f.id))} aria-label={'Remove ' + f.name}><X size={13}/></button></div>)}</div>}
          {attachments.some(f => f.kind === 'image') && <div className="attachment-hint">{mode === 'video' ? 'Video: one image sets the first frame; multiple images guide keyframes in attachment order.' : mode === 'image' ? 'Images are visual references. Describe what to preserve or change.' : 'Images can be analyzed in chat or used as generation references.'}</div>}
          <textarea ref={input} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} placeholder={mode === 'video' ? 'Describe the motion, scene and sound…' : mode === 'image' ? 'Describe the image you have in mind…' : mode==='speech'?'Enter text to speak or describe a voiceover…':mode==='music'?'Describe a song, instruments, mood or lyrics…':mode==='sfx'?'Describe the sound you want to hear…':'Ask anything, or describe what you want to create…'} aria-label="Message Wizgard" rows={2} maxLength={16000} disabled={busy}/>
          <div className="composer-controls"><div className="composer-left"><button type="button" className="icon-button" disabled={busy || uploading || attachments.length >= 10} title="Attach files (up to 10)" aria-label="Attach files" onClick={() => fileInput.current?.click()}>{uploading ? <LoaderCircle className="spin" size={17}/> : <Paperclip size={17}/>}</button><button type="button" className={'icon-button web-toggle ' + (settings.web ? 'enabled' : '')} aria-label="Web access" aria-pressed={settings.web} title={settings.web ? 'Web access on' : 'Web access off'} disabled={busy || !activeModes.includes('chat')} onClick={() => setSettings(s => ({ ...s, web: !s.web }))}><Globe size={17}/></button><div className="mode-wrap"><button type="button" className={'mode-button ' + (mode === 'image' ? 'image-mode' : '')} onClick={() => setModeMenu(!modeMenu)} disabled={busy}><ModeIcon size={15}/>{modeLabels[mode]}<ChevronDown size={13}/></button>{modeMenu && <div className="mode-menu">{[['auto', 'Let Wizgard choose the right model'], ['chat', 'Talk with Qwen 3.8'], ['image', 'Create with Qwen Image 2.1'], ['video', 'Create clips with Sulphur 2'],['speech','Speak with Qwen3-TTS'],['music','Compose with ACE-Step'],['sfx','Create with MOSS SoundEffect']].filter(([key])=>key==='auto'||activeModes.includes(key)).map(([key, label]) => { const Icon = modeIcons[key]; return <button key={key} type="button" onClick={() => { setMode(key); setModeMenu(false); }}><Icon size={17}/><div><strong>{modeLabels[key]}</strong><span>{label}</span></div>{key === mode && <Check size={14}/>}</button>; })}</div>}</div><button type="button" className="composer-settings" title="Generation settings" aria-label="Generation settings" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={15}/><span>{mode === 'image' ? settings.width + ' × ' + settings.height : settings.thinking ? 'Thinking on' : 'Local models'}</span></button></div>{busy ? <button type="button" className="send-button stop" title="Stop generation" aria-label="Stop generation" onClick={stop}><Square size={15} fill="currentColor"/></button> : <button className="send-button" type="submit" disabled={(!text.trim() && !attachments.length) || !ready || uploading} title="Send message" aria-label="Send message"><ArrowUp size={20}/></button>}</div>
        </form><div className="composer-footnote"><span className="tiny-lock"><HardDrive size={11}/> Your conversations stay on this computer.</span><span>Enter to send <i>·</i> Shift + Enter for a new line</span></div>
      </div></>}
      <footer className="app-credit"><div>An AI Tool developed by <strong>Karmikal Apps</strong> &copy; 2026</div><div className="app-version">{appInfo.version}</div></footer>
    </main>
    {clearOpen && <div className="modal-backdrop clear-backdrop" onClick={() => { if (!clearing) setClearOpen(false); }}><section className="clear-modal" role="dialog" aria-modal="true" aria-labelledby="clear-title" aria-describedby="clear-description" onClick={e => e.stopPropagation()}><div className="clear-icon"><Trash2 size={23}/></div><h2 id="clear-title">Clear Workspace</h2><p id="clear-description">Permanently delete all chats, attachments, generated images, videos and audio from this workspace, including configured output locations?</p><p>Your downloaded models, runtimes, and app settings will be kept. This cannot be undone.</p>{clearError && <p className="inline-error">{clearError}</p>}<div className="clear-actions"><button className="cancel-button" autoFocus disabled={clearing} onClick={() => setClearOpen(false)}>Cancel</button><button className="danger-button" disabled={clearing || busy} onClick={clearWorkspace}>{clearing ? 'Clearing…' : 'Clear Workspace'}</button></div></section></div>}
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><div className="section-kicker">MAKE IT YOURS</div><h2 id="settings-title">Workspace settings</h2></div><button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={20}/></button></div>{manager?.models.filter(m=>m.installed).map(m=>{const Icon=capabilityIcons[m.id];return <div className="model-setting" key={m.id}><Icon size={20}/><div><strong>{m.name}</strong><p>{m.subtitle}</p></div><span className={'pill '+(m.active?'good':'')}>{m.active?'Active':'Inactive'}</span></div>;})}<button className="subtle-button" onClick={()=>{setSettingsOpen(false);setModelsOpen(true);}}>Manage models & output location →</button>{health?.runtime.error && <p className="inline-error">{health.runtime.error}</p>}
      <div className="setting-row"><div><strong>Thinking mode</strong><p>Allow more reasoning before a chat answer.</p></div><button className={'toggle ' + (settings.thinking ? 'on' : '')} role="switch" aria-checked={settings.thinking} aria-label="Thinking mode" onClick={() => setSettings(s => ({ ...s, thinking: !s.thinking }))}><span/></button></div>
      <div className="setting-row"><div><strong>Web access</strong><p>Search and read public pages when useful. Queries go online; files stay local.</p></div><button className={'toggle ' + (settings.web ? 'on' : '')} role="switch" aria-checked={settings.web} aria-label="Enable web access" onClick={() => setSettings(s => ({ ...s, web: !s.web }))}><span/></button></div>
      {activeModes.some(k=>['speech','music','sfx'].includes(k))&&<><h3>Audio generation</h3><div className="settings-grid">{activeModes.includes('speech')&&<><label>Voice<select value={settings.voice} onChange={e=>setSettings(s=>({...s,voice:e.target.value}))}>{['Ryan','Aiden','Vivian','Serena','Uncle_Fu','Dylan','Eric','Ono_Anna','Sohee'].map(v=><option key={v}>{v}</option>)}</select></label><label>Language<select value={settings.language} onChange={e=>setSettings(s=>({...s,language:e.target.value}))}>{['Auto','English','Chinese','Japanese','Korean','German','French','Russian','Portuguese','Spanish','Italian'].map(v=><option key={v}>{v}</option>)}</select></label><label>Voice style<input value={settings.voiceStyle} maxLength={1000} placeholder="Warm and expressive" onChange={e=>setSettings(s=>({...s,voiceStyle:e.target.value}))}/></label></>}{activeModes.includes('music')&&<label>Music duration (seconds)<input type="number" min="5" max="180" value={settings.musicSeconds} onChange={e=>setSettings(s=>({...s,musicSeconds:Number(e.target.value)}))}/></label>}{activeModes.includes('music')&&<label>Lyrics (optional)<textarea className="lyrics-input" value={settings.musicLyrics} maxLength={10000} rows={4} placeholder="[Verse]… Leave empty to follow the prompt" onChange={e=>setSettings(s=>({...s,musicLyrics:e.target.value}))}/></label>}{activeModes.includes('sfx')&&<label>Effects duration (seconds)<input type="number" min="1" max="30" value={settings.sfxSeconds} onChange={e=>setSettings(s=>({...s,sfxSeconds:Number(e.target.value)}))}/></label>}</div><p className="settings-note">A duration in your prompt overrides the default, up to 180 seconds for music or 30 seconds for effects.</p></>}
      {activeModes.includes('video')&&<><h3>Video generation</h3><div className="settings-grid"><label>Video size<select value={settings.videoWidth + 'x' + settings.videoHeight} onChange={e => { const [videoWidth,videoHeight] = e.target.value.split('x').map(Number); setSettings(s => ({ ...s, videoWidth, videoHeight })); }}>{[[512,320],[512,512],[768,512],[512,768]].map(([w,h]) => <option key={w+'x'+h} value={w+'x'+h}>{w} × {h}</option>)}</select></label><label>Duration<select value={settings.videoSeconds} onChange={e => setSettings(s => ({ ...s, videoSeconds: Number(e.target.value) }))}>{[2,4,6,8].map(n => <option key={n} value={n}>{n} seconds</option>)}</select></label><label>Sound<select value={String(settings.videoAudio)} onChange={e => setSettings(s => ({ ...s, videoAudio: e.target.value === 'true' }))}><option value="true">Generate audio</option><option value="false">Silent video</option></select></label></div><p className="settings-note">Start with a 2-second clip. One image sets the opening frame; several images guide ordered keyframes. Longer clips and more references need more memory and time.</p>
      </>}{activeModes.includes('image')&&<><h3>Image generation</h3><div className="settings-grid"><label>Image size<select value={settings.width + 'x' + settings.height} onChange={e => { const [width, height] = e.target.value.split('x').map(Number); setSettings(s => ({ ...s, width, height })); }}>{[[512,512],[768,768],[1024,1024],[1536,1024],[1024,1536],[2048,2048]].map(([w,h]) => <option key={w+'x'+h} value={w+'x'+h}>{w} × {h}{w===1024&&h===1024 ? ' · Default' : ''}</option>)}</select></label><label>Steps<input type="number" min="1" max="60" value={settings.steps} onChange={e => setSettings(s => ({ ...s, steps: Number(e.target.value) }))}/></label><label>Seed <span>(-1 = random)</span><input type="number" min="-1" max="2147483647" value={settings.seed} onChange={e => setSettings(s => ({ ...s, seed: Number(e.target.value) }))}/></label><label>Image runtime<select value={settings.backend} onChange={e => setSettings(s => ({ ...s, backend: e.target.value }))}><option value="auto">Auto · best available</option>{health?.engines.cuda && <option value="cuda">NVIDIA GPU · CUDA</option>}{health?.engines.metal && <option value="metal">Apple GPU · Metal</option>}{health?.engines.vulkan && <option value="vulkan">GPU · Vulkan</option>}<option value="cpu">CPU · much slower</option></select></label></div><p className="settings-note"><CircleHelp size={14}/> Models take turns using GPU memory. Native 2K images need more time and memory. Use the Run script for your operating system. GPU support depends on the hardware and drivers on that computer.</p></>}<div className="settings-footer"><span>Wizgard {appInfo.version} · Local workspace</span><button className="subtle-button" onClick={() => { setSettings(initialSettings); }}>Reset settings</button></div><button className="shutdown-button" onClick={async () => { if (busy) { setError('Stop generation before shutting down.'); return; } await fetch('/api/shutdown', { method: 'POST' }); setHealth(null); setSettingsOpen(false); setError('Wizgard is shut down. Use the Run script for your operating system to start it again.'); }}><Power size={14}/> Shut down local runtimes</button></section></div>}
    {modelsOpen && <ModelManagerView state={manager} output={health?.output} onRefresh={refreshHealth} onClose={()=>setModelsOpen(false)}/>}
    {lightbox && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Generated image" onClick={() => setLightbox(null)}><button className="lightbox-close" aria-label="Close image" onClick={() => setLightbox(null)}><X size={22}/></button><img src={lightbox.imageUrl} alt={lightbox.imagePrompt} onClick={e => e.stopPropagation()}/><a className="primary-button" href={lightbox.imageUrl} download={'Wizgard-'+lightbox.seed+'.png'} onClick={e => e.stopPropagation()}><Download size={16}/> Download image</a></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
