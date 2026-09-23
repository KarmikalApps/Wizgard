import test from 'node:test';
import assert from 'node:assert/strict';
import {audioBrief,estimateAudioSeconds} from '../server/audio-policy.mjs';
import {validateRequest} from '../server/policy.mjs';
import {normalizeAudioSettings} from '../src/audio-options.mjs';
test('music defaults to 120 seconds regardless of lyrics length',()=>{
 const settings=validateRequest({mode:'music',prompt:'Create a song'}).settings;
 assert.equal(settings.musicSeconds,120);
 for(const lyrics of ['[Instrumental]','Hello world','hello '.repeat(900)]){
  const brief=audioBrief('music','Create a song',settings,{lyrics});assert.equal(brief.seconds,120);assert.equal(brief.durationSource,'manual');
 }
});
test('saved Auto settings migrate in the browser and in retried API requests',()=>{
 const saved={musicSeconds:'auto',sfxSeconds:'auto',seed:123};
 assert.deepEqual(normalizeAudioSettings(saved),{musicSeconds:120,sfxSeconds:'auto',seed:123});assert.equal(saved.musicSeconds,'auto');
 for(const mode of ['chat','music','auto'])assert.equal(validateRequest({mode,prompt:'test',settings:saved}).settings.musicSeconds,120);
 assert.equal(normalizeAudioSettings({musicSeconds:45}).musicSeconds,45);
});
test('typed music durations accept the supported range and reject invalid values',()=>{
 for(const seconds of [5,45,120,180]){
  const settings=validateRequest({mode:'music',prompt:'song',settings:{musicSeconds:seconds}}).settings;
  assert.equal(audioBrief('music','song',settings).seconds,seconds);
 }
 for(const seconds of [4,181,0,NaN,'',12.5,'invalid'])assert.throws(()=>validateRequest({mode:'music',prompt:'song',settings:{musicSeconds:seconds}}),/5–180/);
});
test('prompt durations override the music field while sound-effect Auto remains available',()=>{
 const settings=validateRequest({mode:'music',prompt:'song'}).settings;
 assert.equal(audioBrief('music','Create 1.5 minutes of music',settings).seconds,90);
 assert.equal(audioBrief('music','Create 30 seconds of piano music',settings).seconds,30);
 assert.equal(audioBrief('music','Create 500 seconds of music',settings).seconds,180);
 assert.equal(audioBrief('sfx','Create 500 seconds of rain',settings).seconds,30);
 assert.equal(audioBrief('sfx','A door opens and shuts',settings).durationSource,'auto');
 assert.ok(estimateAudioSeconds('你好世界'.repeat(30))>estimateAudioSeconds('你好世界'));
});
test('speech preserves the full requested text and uses natural duration',()=>{
 const settings=validateRequest({mode:'speech',prompt:'say hello'}).settings;
 const text='Every sentence should be read. '.repeat(60),brief=audioBrief('speech','Narrate this text',settings,{text});
 assert.equal(brief.text,text);assert.equal(brief.durationSource,'natural');
});
