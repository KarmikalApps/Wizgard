import {defaults,normalizeNotifications,notificationEligible,claimNotification} from './notification-policy.mjs';
import React,{useEffect,useRef,useState} from 'react';
import {Bell,Volume2} from 'lucide-react';
let audioContext;
async function unlockSound(){const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;audioContext??=new Audio();if(audioContext.state==='suspended')await audioContext.resume();}
async function ding(volume){await unlockSound();if(!audioContext||audioContext.state!=='running')return;const time=audioContext.currentTime;for(const [frequency,offset,level] of [[659.25,0,.17],[987.77,.13,.12]]){const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(0,time+offset);gain.gain.linearRampToValueAtTime(volume*level,time+offset+.012);gain.gain.exponentialRampToValueAtTime(.0001,time+offset+1.1);oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(time+offset);oscillator.stop(time+offset+1.2);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};}}
function permission(){return typeof Notification==='undefined'?'unavailable':Notification.permission;}
export function useGenerationNotifications(recentJobs,onOpen){
 const [prefs,setPrefs]=useState(()=>{try{return normalizeNotifications(JSON.parse(localStorage.getItem('wizgard-notifications')||'{}'));}catch{return defaults;}}),[access,setAccess]=useState(permission),[error,setError]=useState('');
 const current=useRef(prefs),open=useRef(onOpen),mounted=useRef(Date.now()),seen=useRef(new Set());current.current=prefs;open.current=onOpen;
 useEffect(()=>{localStorage.setItem('wizgard-notifications',JSON.stringify(prefs));},[prefs]);
 useEffect(()=>{const update=e=>{if(e.key==='wizgard-notifications'){try{setPrefs(normalizeNotifications(JSON.parse(e.newValue||'{}')));}catch{}}};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update);},[]);
 useEffect(()=>{if(!prefs.enabled||!prefs.sound)return;const unlock=()=>{void unlockSound().catch(()=>{});};window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);return()=>{window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);};},[prefs.enabled,prefs.sound]);
 async function deliver(job,test=false){
  const options=current.current;if(!options.enabled)return;
  if(options.sound)void ding(options.volume).catch(()=>{});
  if(options.desktop&&permission()==='granted'){
   try{const notification=new Notification(test?'Wizgard · Test notification':job.state==='error'?'Wizgard · Generation failed':'Wizgard · Generation complete',{body:test?'Your local workspace notifications are ready.':job.state==='error'?'A generation needs attention. Open its conversation for details.':'Your '+({chat:'response',image:'image',video:'video',music:'music',speech:'speech',sfx:'sound effect'}[job.route]||'generation')+' is ready. Click to open its conversation.',icon:'/wizgard-icon.png',tag:'wizgard-'+job.id,silent:true});notification.onclick=()=>{window.focus();if(job.conversationId)open.current(job.conversationId);notification.close();};}catch{setError('This browser could not display an OS notification. Check its notification permissions.');}
  }
 }
 useEffect(()=>{
  for(const job of recentJobs||[]){
   if(seen.current.has(job.id)||!notificationEligible(job,prefs,mounted.current))continue;seen.current.add(job.id);
   const notify=async()=>{
    if(!notificationEligible(job,current.current,mounted.current)||!claimNotification(localStorage,job.id))return;await deliver(job);
   };
   void (navigator.locks?navigator.locks.request('wizgard-completion-notification',notify):notify()).catch(()=>{});
  }
 },[recentJobs,prefs]);
 async function change(patch){
  setError('');const next={...current.current,...patch};if(patch.enabled===true&&!current.current.enabled)next.enabledAt=Date.now();
  current.current=next;setPrefs(next);
  if(next.enabled&&next.sound)void unlockSound().catch(()=>{});
  if(next.enabled&&next.desktop&&permission()==='default'){try{setAccess(await Notification.requestPermission());}catch{setAccess(permission());}}
  else setAccess(permission());
 }
 return {prefs,access,error,change,test:()=>deliver({id:'test',state:'complete'},true)};
}
export function NotificationSettings({controller}){
 const {prefs,access,error,change,test}=controller;
 return <section className="notification-settings"><h3><Bell size={16}/>Completion notifications</h3><div className="setting-row"><div><strong>Enable notifications</strong><p>A gentle ding and optional OS notification when a job finishes.</p></div><button className={'toggle '+(prefs.enabled?'on':'')} role="switch" aria-label="Enable completion notifications" aria-checked={prefs.enabled} onClick={()=>void change({enabled:!prefs.enabled})}><span/></button></div>
 {prefs.enabled&&<><div className="notification-options">{[['desktop','OS notification'],['sound','Gentle ding'],['errors','Notify on errors']].map(([key,label])=><label key={key}><input type="checkbox" checked={prefs[key]} onChange={e=>void change({[key]:e.target.checked})}/>{label}</label>)}</div>{prefs.sound&&<label className="notification-volume"><Volume2 size={15}/>Ding volume<input aria-label="Notification volume" type="range" min="0" max="1" step=".05" value={prefs.volume} onChange={e=>void change({volume:Number(e.target.value)})}/><span>{Math.round(prefs.volume*100)}%</span></label>}
 <p className="settings-note">{prefs.desktop?(access==='granted'?'OS notifications are allowed.':access==='denied'?'OS notifications are blocked. Allow them in your browser’s site permissions to use this option.':access==='unavailable'?'OS notifications are unavailable in this browser. Use a browser that supports desktop notifications.':'Allow the browser notification request to enable OS notifications.'):'OS notifications are off.'} Keep a Wizgard tab open; notifications can arrive while it is in the background. Stopped jobs stay silent.</p><button className="subtle-button notification-test" onClick={()=>void test()}>Test notification &amp; ding</button></>}{error&&<p className="inline-error">{error}</p>}</section>;
}
