export function generationRecord(message,request=null,brief=null){
 const mode=message.audioKind||message.kind||(message.imageUrl?'image':message.videoUrl?'video':'audio');
 const settings={...(request?.settings||{})};
 if(Number.isSafeInteger(message.seed))settings.seed=message.seed;
 if(mode==='image'){
  for(const key of ['width','height','steps','backend','imageModel'])if(message[key]!=null)settings[key]=message[key];
  if(!settings.imageModel&&message.model)settings.imageModel=/FLUX/i.test(message.model)?'flux2':'qwen';
 }
 if(mode==='video'){
  for(const [key,source] of [['videoWidth','width'],['videoHeight','height'],['videoFps','fps'],['videoAudio','audio'],['videoModel','videoModel']])if(message[source]!=null)settings[key]=message[source];
  if(!settings.videoModel&&message.model)settings.videoModel=/Sulphur/i.test(message.model)?'sulphur':'ltx25';
 }
 if(brief){
  if(mode==='music'){settings.musicSeconds=brief.seconds;settings.musicLyrics=brief.lyrics;}
  if(mode==='sfx')settings.sfxSeconds=brief.seconds;
  if(mode==='speech'){settings.voice=brief.voice;settings.language=brief.language;settings.voiceStyle=brief.style;}
 }
 return {source:request?'recorded':'partial',mode,settings,request:request?structuredClone({prompt:request.prompt,mode:request.mode,settings:request.settings,attachmentIds:request.attachmentIds||[]}):null,
  actual:{seed:message.seed,width:message.width,height:message.height,steps:message.steps,seconds:message.seconds,fps:message.fps,audio:message.audio,sampleRate:message.sampleRate,backend:message.backend,referenceCount:message.referenceCount},
  ...(brief?{audioBrief:structuredClone(brief)}:{})};
}
