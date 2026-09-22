import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Plus, Search, Settings2, ArrowUp, Square, Sparkles, Image, MessageSquare, ChevronDown, PanelLeftClose, PanelLeftOpen, Download, Copy, Check, Trash2, X, ArrowUpRight, Cpu, HardDrive, CircleHelp, Command, CheckCircle2, LoaderCircle, Power, SlidersHorizontal, Grid2X2 } from 'lucide-react';
import './styles.css';
import appInfo from '../app-info.json';

const initialSettings = { width: 1024, height: 1024, steps: 25, seed: -1, backend: 'auto', thinking: false };
const examples = [
  { icon: Sparkles, label: 'Think something through', text: 'Help me think through a creative project I want to start.' },
  { icon: Image, label: 'Make something visual', text: 'Create an image of a tiny cabin inside a glass terrarium, warm evening light, botanical details, cinematic photography.' },
  { icon: Command, label: 'Build something useful', text: 'Write a JavaScript function that groups an array of objects by a property. Explain it with an example.' },
];
const modeLabels = { auto: 'Auto', chat: 'Chat', image: 'Image' };
const modeIcons = { auto: Sparkles, chat: MessageSquare, image: Image };
function Mark({ small = false }) { return <div className={'mark ' + (small ? 'small' : '')}><img src="/wizgard-icon.png" alt="" width={small ? 32 : 48} height={small ? 32 : 48} /></div>; }
function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return <button className="icon-button" aria-label={copied ? 'Copied' : 'Copy response'} title="Copy" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>;
}
function App() {
  const [health, setHealth] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState('');
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
  const images = conversations.flatMap(c => c.messages.filter(m => m.imageUrl).map(m => ({ ...m, conversationId: c.id })));
  const ready = health?.runtime.ready;
  const ModeIcon = modeIcons[mode];
  useEffect(() => {
    const refresh = () => fetch('/api/health').then(r => r.json()).then(setHealth).catch(() => setHealth(null));
    refresh();
    fetch('/api/conversations').then(r => r.json()).then(setConversations).catch(() => setError('Could not load conversations.'));
    const timer = setInterval(refresh, 4000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { localStorage.setItem('wizgard-settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [current?.messages.length, streaming?.content, streaming?.thinking, status]);
  useEffect(() => {
    const key = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSidebar(true); setTimeout(() => searchInput.current?.focus(), 20); }
      if (event.key === 'Escape') { setSettingsOpen(false); setModeMenu(false); setLightbox(null); if (!clearing) setClearOpen(false); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [clearing]);
  function updateConversation(c) { setConversations(old => [c, ...old.filter(item => item.id !== c.id)]); setSelected(c.id); }
  async function clearWorkspace() {
    if (busy || clearing) return;
    setClearing(true); setClearError('');
    try {
      const response = await fetch('/api/workspace/clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE_ALL_CHATS_AND_IMAGES' }) });
      if (!response.ok) throw new Error((await response.json()).error);
      setConversations([]); setSelected(null); setStreaming(null); setLightbox(null); setText(''); setSearch(''); setError(''); setView('chat'); setSettingsOpen(false); setClearOpen(false);
      setNotice('Workspace cleared. Your models and settings are ready for a fresh start.');
    } catch (err) { setClearError(err.message); }
    finally { setClearing(false); }
  }
  function newChat() { if (busy) return; setSelected(null); setView('chat'); setText(''); setError(''); setNotice(''); setStreaming(null); setTimeout(() => input.current?.focus(), 20); }
  async function removeConversation(event, id) {
    event.stopPropagation(); const response = await fetch('/api/conversations/' + id, { method: 'DELETE' });
    if (!response.ok) { setError((await response.json()).error); return; }
    setConversations(old => old.filter(c => c.id !== id)); if (selected === id) setSelected(null);
  }
  async function send(event) {
    event?.preventDefault();
    if (!text.trim() || busy || !ready) return;
    const prompt = text.trim(); setText(''); setBusy(true); setError(''); setNotice(''); setStatus('Getting ready…'); setProgress(null); setView('chat');
    const controller = new AbortController(); abortRef.current = controller;
    let live = { id: 'streaming', role: 'assistant', content: '', thinking: '' };
    try {
      const response = await fetch('/api/message', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: selected, prompt, mode, settings }), signal: controller.signal });
      if (!response.ok) { setText(prompt); throw new Error((await response.json()).error); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
      function consume(block) {
        const eventName = block.match(/^event: (.+)$/m)?.[1];
        const dataLine = block.split('\n').find(line => line.startsWith('data: ')); if (!dataLine) return;
        const data = JSON.parse(dataLine.slice(6));
        if (eventName === 'conversation') { updateConversation(data.conversation); setStreaming({ ...live }); }
        if (eventName === 'status') { setStatus(data.text); setProgress(data.progress ?? null); }
        if (eventName === 'notice') setNotice(data.text);
        if (eventName === 'route') { live = { ...live, kind: data.route, model: data.model }; setStreaming({ ...live }); }
        if (eventName === 'token') { live.content += data.text; setStreaming({ ...live }); setStatus(''); }
        if (eventName === 'thinking') { live.thinking += data.text; setStreaming({ ...live }); setStatus('Thinking…'); }
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
        {m.content && <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ img: ({ src, alt }) => src?.startsWith('/generated/') ? <img src={src} alt={alt || ''}/> : <span>{alt || 'Image reference'}</span> }}>{m.content}</ReactMarkdown></div>}
        {m.imageUrl && <figure className="image-result"><button className="image-preview" onClick={() => setLightbox(m)} aria-label="View generated image"><img src={m.imageUrl} alt={m.imagePrompt || 'Generated image'} /></button><figcaption><span>{m.width} × {m.height} <i>·</i> {m.steps} steps <i>·</i> Seed {m.seed}</span><a href={m.imageUrl} download={'Wizgard-' + m.seed + '.png'} title="Download image" aria-label="Download image"><Download size={16}/></a></figcaption><details><summary>Image prompt</summary><p>{m.imagePrompt}</p></details></figure>}
        {m.error && <div className={'inline-error ' + (m.cancelled ? 'cancelled' : '')}>{m.error}</div>}
        {m.role === 'assistant' && m.id !== 'streaming' && (m.content || m.imageUrl) && <div className="message-actions"><CopyButton value={m.imagePrompt || m.content}/>{m.metrics && <span>{m.metrics.seconds}s · {m.metrics.tokens} tokens</span>}</div>}
      </div>
    </article>;
  }
  return <div className={'app ' + (!sidebar ? 'sidebar-hidden' : '')}>
    <aside className="sidebar">
      <div className="brand-row"><Mark small/><strong>Wizgard</strong><button className="icon-button" title="Hide sidebar" aria-label="Hide sidebar" onClick={() => setSidebar(false)}><PanelLeftClose size={17}/></button></div>
      <button className="new-chat" onClick={newChat} disabled={busy}><Plus size={17}/> New conversation <span>↗</span></button>
      <div className="search"><Search size={15}/><input ref={searchInput} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations" aria-label="Search conversations"/><kbd>⌃ K</kbd></div>
      <button className={'nav-item ' + (view === 'library' ? 'active' : '')} onClick={() => setView('library')}><Grid2X2 size={16}/> Image library <span>{images.length || ''}</span></button>
      <div className="history-title">CONVERSATIONS <span>{conversations.length}</span></div>
      <div className="history">
        {!conversations.length && <div className="empty-history">A fresh page for your ideas.<br/>Your conversations will appear here.</div>}
        {conversations.filter(c => c.title.toLowerCase().includes(search.toLowerCase())).map(c => <div className={'conversation-item ' + (selected === c.id && view === 'chat' ? 'active' : '')} key={c.id}><button onClick={() => { if (!busy) { setSelected(c.id); setView('chat'); setError(''); } }} title={c.title}><MessageSquare size={14}/><span>{c.title}</span></button><button className="delete-chat" onClick={e => removeConversation(e, c.id)} aria-label={'Delete ' + c.title} title="Delete conversation" disabled={busy}><Trash2 size={13}/></button></div>)}
      </div>
      <div className="sidebar-bottom">
        <div className="local-card"><span className={'status-dot ' + (ready ? 'online' : '')}/><div><strong>{ready ? 'All yours. All local.' : health?.runtime.error ? 'Setup needs attention' : 'Starting local models'}</strong><p>{ready ? 'No cloud. No subscriptions.' : 'Check model settings for details.'}</p></div></div>
        <button className="nav-item settings-link" onClick={() => setSettingsOpen(true)}><Settings2 size={16}/> Settings <span>⌘</span></button>
        <button className="nav-item clear-workspace" disabled={busy || clearing || !!health?.busy} onClick={() => { setClearError(''); setClearOpen(true); }}><Trash2 size={16}/> Clear Workspace</button>
        <div className="profile"><span className="avatar">Y</span><div><strong>Your workspace</strong><span>On this computer</span></div><span className="local-badge">LOCAL</span></div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar"><div>{!sidebar && <button className="icon-button" title="Show sidebar" aria-label="Show sidebar" onClick={() => setSidebar(true)}><PanelLeftOpen size={18}/></button>}<span className="breadcrumb">Workspace</span><span className="slash">/</span><strong>{view === 'library' ? 'Image library' : current?.title || 'New conversation'}</strong></div><div className="topbar-right"><span className="model-count"><span className={'status-dot ' + (ready ? 'online' : '')}/>2 local models</span><button className="icon-button" title="Model settings" aria-label="Model settings" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={17}/></button></div></header>
      {view === 'library' ? <section className="library"><div className="section-kicker">YOUR CREATIVE COLLECTION</div><h1>Made here. Kept here.</h1><p>Every image you create, in one place.</p>{images.length ? <div className="image-grid">{images.map(m => <button key={m.id} onClick={() => setLightbox(m)}><img src={m.imageUrl} alt={m.imagePrompt}/><span>{m.imagePrompt}</span></button>)}</div> : <div className="library-empty"><Image size={32}/><h3>A little room for imagination.</h3><p>Create your first image in a conversation.</p><button className="primary-button" onClick={() => { newChat(); setMode('image'); }}>Create an image <ArrowUpRight size={15}/></button></div>}</section>
      : <><div className={'chat-scroll ' + (!current && !streaming ? 'is-empty' : '')}>
        {!current && !streaming ? <section className="welcome"><div className="welcome-symbol"><img src="/wizgard-icon.png" alt="Wizgard emblem" width="70" height="70"/></div><div className="section-kicker">YOUR SPACE TO THINK & CREATE</div><h1>A little magic.<br/><span>Entirely yours.</span></h1><p>Ask a question, explore an idea, or imagine an image.<br/>Two local models. One conversation.</p><div className="suggestions">{examples.map(({ icon: Icon, label, text: prompt }) => <button key={label} onClick={() => { setText(prompt); setMode('auto'); input.current?.focus(); }}><Icon size={19}/><span>{label}</span><ArrowUpRight size={15}/></button>)}</div><div className="powered"><span>Qwen 3.8 <small>for thinking</small></span><span className="powered-plus">+</span><span>Qwen Image 2.1 <small>for creating</small></span></div></section>
        : <div className="messages">{current?.messages.map(message)}{streaming && message(streaming)}{busy && status && <div className="generation-status"><LoaderCircle size={15} className="spin"/><span>{status}</span>{progress !== null && <><span>{progress}%</span><div className="progress-bar"><i style={{ width: progress + '%' }}/></div></>}</div>}<div ref={bottom}/></div>}
      </div><div className="composer-area">
        {!ready && <div className="runtime-banner">{health?.runtime.error || health?.runtime.message || (health ? 'Starting the local runtime…' : 'Connecting to Wizgard…')}<button onClick={() => setSettingsOpen(true)}>Details</button></div>}
        {notice && <div className="notice">{notice}</div>}
        {error && <div className="error-banner">{error}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={14}/></button></div>}
        <form className={'composer ' + (busy ? 'working' : '')} onSubmit={send}>
          <textarea ref={input} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} placeholder={mode === 'image' ? 'Describe the image you have in mind…' : 'Ask anything, or describe an image…'} aria-label="Message Wizgard" rows={2} maxLength={16000} disabled={busy}/>
          <div className="composer-controls"><div className="composer-left"><div className="mode-wrap"><button type="button" className={'mode-button ' + (mode === 'image' ? 'image-mode' : '')} onClick={() => setModeMenu(!modeMenu)} disabled={busy}><ModeIcon size={15}/>{modeLabels[mode]}<ChevronDown size={13}/></button>{modeMenu && <div className="mode-menu">{[['auto', 'Let Wizgard choose the right model'], ['chat', 'Talk with Qwen 3.8'], ['image', 'Create with Qwen Image 2.1']].map(([key, label]) => { const Icon = modeIcons[key]; return <button key={key} type="button" onClick={() => { setMode(key); setModeMenu(false); }}><Icon size={17}/><div><strong>{modeLabels[key]}</strong><span>{label}</span></div>{key === mode && <Check size={14}/>}</button>; })}</div>}</div><button type="button" className="composer-settings" title="Generation settings" aria-label="Generation settings" onClick={() => setSettingsOpen(true)}><SlidersHorizontal size={15}/><span>{mode === 'image' ? settings.width + ' × ' + settings.height : settings.thinking ? 'Thinking on' : 'Local models'}</span></button></div>{busy ? <button type="button" className="send-button stop" title="Stop generation" aria-label="Stop generation" onClick={stop}><Square size={15} fill="currentColor"/></button> : <button className="send-button" type="submit" disabled={!text.trim() || !ready} title="Send message" aria-label="Send message"><ArrowUp size={20}/></button>}</div>
        </form><div className="composer-footnote"><span className="tiny-lock"><HardDrive size={11}/> Your conversations stay on this computer.</span><span>Enter to send <i>·</i> Shift + Enter for a new line</span></div>
      </div></>}
      <footer className="app-credit"><div>An AI Tool developed by <strong>Karmikal Apps</strong> &copy; 2026</div><div className="app-version">{appInfo.version}</div></footer>
    </main>
    {clearOpen && <div className="modal-backdrop clear-backdrop" onClick={() => { if (!clearing) setClearOpen(false); }}><section className="clear-modal" role="dialog" aria-modal="true" aria-labelledby="clear-title" aria-describedby="clear-description" onClick={e => e.stopPropagation()}><div className="clear-icon"><Trash2 size={23}/></div><h2 id="clear-title">Clear Workspace</h2><p id="clear-description">Permanently delete all chats and generated images from this workspace?</p><p>Your downloaded models, runtimes, and app settings will be kept. This cannot be undone.</p>{clearError && <p className="inline-error">{clearError}</p>}<div className="clear-actions"><button className="cancel-button" autoFocus disabled={clearing} onClick={() => setClearOpen(false)}>Cancel</button><button className="danger-button" disabled={clearing || busy} onClick={clearWorkspace}>{clearing ? 'Clearing…' : 'Clear Workspace'}</button></div></section></div>}
    {settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={e => e.stopPropagation()}><div className="modal-heading"><div><div className="section-kicker">MAKE IT YOURS</div><h2 id="settings-title">Workspace settings</h2></div><button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={20}/></button></div><div className="model-setting"><Cpu size={20}/><div><strong>Qwen 3.8 · 27B</strong><p>HauhauCS Aggressive · Q4_K_P · Ollama</p></div><span className={'pill ' + (ready ? 'good' : '')}>{ready ? 'Ready' : 'Starting'}</span></div><div className="model-setting"><Image size={20}/><div><strong>Qwen Image 2.1</strong><p>0xSojalSec · Q8_0 · local image runtime</p></div><span className={'pill ' + (health?.models.image ? 'good' : '')}>{health?.models.image ? 'Installed' : 'Missing'}</span></div>{health?.runtime.error && <p className="inline-error">{health.runtime.error}</p>}
      <div className="setting-row"><div><strong>Thinking mode</strong><p>Allow more reasoning before a chat answer.</p></div><button className={'toggle ' + (settings.thinking ? 'on' : '')} role="switch" aria-checked={settings.thinking} aria-label="Thinking mode" onClick={() => setSettings(s => ({ ...s, thinking: !s.thinking }))}><span/></button></div>
      <h3>Image generation</h3><div className="settings-grid"><label>Image size<select value={settings.width + 'x' + settings.height} onChange={e => { const [width, height] = e.target.value.split('x').map(Number); setSettings(s => ({ ...s, width, height })); }}>{[[512,512],[768,768],[1024,1024],[1536,1024],[1024,1536],[2048,2048]].map(([w,h]) => <option key={w+'x'+h} value={w+'x'+h}>{w} × {h}{w===1024&&h===1024 ? ' · Default' : ''}</option>)}</select></label><label>Steps<input type="number" min="1" max="60" value={settings.steps} onChange={e => setSettings(s => ({ ...s, steps: Number(e.target.value) }))}/></label><label>Seed <span>(-1 = random)</span><input type="number" min="-1" max="2147483647" value={settings.seed} onChange={e => setSettings(s => ({ ...s, seed: Number(e.target.value) }))}/></label><label>Image runtime<select value={settings.backend} onChange={e => setSettings(s => ({ ...s, backend: e.target.value }))}><option value="auto">Auto · best available</option>{health?.engines.cuda && <option value="cuda">NVIDIA GPU · CUDA</option>}{health?.engines.metal && <option value="metal">Apple GPU · Metal</option>}{health?.engines.vulkan && <option value="vulkan">GPU · Vulkan</option>}<option value="cpu">CPU · much slower</option></select></label></div><p className="settings-note"><CircleHelp size={14}/> Models take turns using GPU memory. Native 2K images need more time and memory. Use the Run script for your operating system. GPU support depends on the hardware and drivers on that computer.</p><div className="settings-footer"><span>Wizgard {appInfo.version} · Local workspace</span><button className="subtle-button" onClick={() => { setSettings(initialSettings); }}>Reset settings</button></div><button className="shutdown-button" onClick={async () => { if (busy) { setError('Stop generation before shutting down.'); return; } await fetch('/api/shutdown', { method: 'POST' }); setHealth(null); setSettingsOpen(false); setError('Wizgard is shut down. Use the Run script for your operating system to start it again.'); }}><Power size={14}/> Shut down local runtimes</button></section></div>}
    {lightbox && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Generated image" onClick={() => setLightbox(null)}><button className="lightbox-close" aria-label="Close image" onClick={() => setLightbox(null)}><X size={22}/></button><img src={lightbox.imageUrl} alt={lightbox.imagePrompt} onClick={e => e.stopPropagation()}/><a className="primary-button" href={lightbox.imageUrl} download={'Wizgard-'+lightbox.seed+'.png'} onClick={e => e.stopPropagation()}><Download size={16}/> Download image</a></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
