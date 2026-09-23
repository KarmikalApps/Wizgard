export const audioNames = { speech: 'Qwen3-TTS', music: 'ACE-Step 1.5 Turbo', sfx: 'MOSS SoundEffect v2' };
export const voices = ['Ryan', 'Aiden', 'Vivian', 'Serena', 'Uncle_Fu', 'Dylan', 'Eric', 'Ono_Anna', 'Sohee'];
export const languages = ['Auto', 'English', 'Chinese', 'Japanese', 'Korean', 'German', 'French', 'Russian', 'Portuguese', 'Spanish', 'Italian'];
// Approximate sound-effect timing from its description.
export function estimateAudioSeconds(text) {
  const clean=String(text||'').replace(/\[[^\]]*\]/g,' ').trim();
  if(!clean)return 10;
  const cjk=(clean.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)||[]).length;
  const words=(clean.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu,' ').match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)||[]).length;
  const pauses=(clean.match(/[.!?。！？]/gu)||[]).length*.35;
  return Math.ceil(words/2.5+cjk/5+2+pauses);
}
export function audioBrief(route, prompt, settings, planned = {}) {
  const duration=prompt.match(/\b(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?)\b/i);
  const explicit=duration?Number(duration[1])*(/^m/i.test(duration[2])?60:1):null;
  const quoted = prompt.match(/[“"]([\s\S]+)[”"]/);
  const spoken = planned.text || quoted?.[1] || prompt.replace(/^(?:please\s+)?(?:read(?:\s+this)?\s+aloud|say|speak|narrate|generate\s+(?:a\s+)?(?:voiceover|speech))\s*:?\s*/i, '');
  if(route === 'speech' && spoken.length > 6000) throw new Error('Speech is limited to 6,000 characters per request. Split the narration into smaller parts.');
  const lyricStart=prompt.search(/\[(?:Verse|Chorus|Bridge|Intro|Outro)\b/i);
  const lyrics=route==='music'?String(settings.musicLyrics || (lyricStart>=0?prompt.slice(lyricStart):planned.lyrics) || '[Instrumental]').slice(0,10000):'';
  const configured=route==='sfx'?settings.sfxSeconds:settings.musicSeconds;
  const automatic=route==='sfx'&&configured==='auto';
  const estimate=automatic?estimateAudioSeconds(planned.prompt||prompt):null;
  const requested=explicit??(automatic?estimate:Number(configured)||(route==='sfx'?10:120));
  const seconds=Math.max(route==='music'?5:1,Math.min(route==='sfx'?30:180,requested));
  const durationSource=route==='speech'?'natural':explicit!==null?'prompt':automatic?'auto':'manual';
  const namedVoice=voices.find(v=>new RegExp('\\b'+v+'\\b','i').test(prompt));
  return { kind: route, prompt: String(planned.prompt || prompt).slice(0, 12000), text: String(spoken).slice(0, 6000), style: String(planned.style || settings.voiceStyle || '').slice(0, 1000), voice: namedVoice || settings.voice, language: settings.language === 'Auto' && languages.includes(planned.language) ? planned.language : settings.language,
    seconds, durationSource, durationLimited:route!=='speech'&&seconds!==requested, lyrics, bpm: Math.max(30, Math.min(300, Number(planned.bpm) || 120)), seed: settings.seed };
}
