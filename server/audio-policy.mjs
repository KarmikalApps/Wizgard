export const audioNames = { speech: 'Qwen3-TTS', music: 'ACE-Step 1.5 Turbo', sfx: 'MOSS SoundEffect v2' };
export const voices = ['Ryan', 'Aiden', 'Vivian', 'Serena', 'Uncle_Fu', 'Dylan', 'Eric', 'Ono_Anna', 'Sohee'];
export const languages = ['Auto', 'English', 'Chinese', 'Japanese', 'Korean', 'German', 'French', 'Russian', 'Portuguese', 'Spanish', 'Italian'];
export function audioBrief(route, prompt, settings, planned = {}) {
  const duration = prompt.match(/\b(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/i);
  const maximum = route === 'sfx' ? 30 : 180;
  const seconds = Math.max(1, Math.min(maximum, Number(duration?.[1]) || Number(planned.seconds) || (route === 'sfx' ? settings.sfxSeconds : settings.musicSeconds)));
  const quoted = prompt.match(/[“"]([\s\S]+)[”"]/);
  const spoken = planned.text || quoted?.[1] || prompt.replace(/^(?:please\s+)?(?:read(?:\s+this)?\s+aloud|say|speak|narrate|generate\s+(?:a\s+)?(?:voiceover|speech))\s*:?\s*/i, '');
  if(route === 'speech' && spoken.length > 6000) throw new Error('Speech is limited to 6,000 characters per request. Split the narration into smaller parts.');
  const lyricStart=prompt.search(/\[(?:Verse|Chorus|Bridge|Intro|Outro)\b/i);
  const namedVoice=voices.find(v=>new RegExp('\\b'+v+'\\b','i').test(prompt));
  return { kind: route, prompt: String(planned.prompt || prompt).slice(0, 12000), text: String(spoken).slice(0, 6000), style: String(planned.style || settings.voiceStyle || '').slice(0, 1000), voice: namedVoice || settings.voice, language: settings.language === 'Auto' && languages.includes(planned.language) ? planned.language : settings.language,
    seconds, lyrics: route === 'music' ? String(settings.musicLyrics || (lyricStart>=0?prompt.slice(lyricStart):planned.lyrics) || '[Instrumental]').slice(0, 10000) : '', bpm: Math.max(30, Math.min(300, Number(planned.bpm) || 120)), seed: settings.seed };
}
