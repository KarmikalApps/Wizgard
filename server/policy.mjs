import { normalizeAudioSettings } from '../src/audio-options.mjs';
import { imageOptions } from '../src/image-options.mjs';
import { videoOptions } from '../src/video-options.mjs';
import { voices, languages } from './audio-policy.mjs';
import { validateAttachmentIds } from './attachments.mjs';
export function validateRequest(body) {
  const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!body || typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 16000) fail('Enter a message between 1 and 16,000 characters.');
  if (!['auto', 'chat', 'image', 'video', 'speech', 'music', 'sfx'].includes(body.mode)) fail('Choose an available generation mode.');
  if (body.conversationId && !/^[0-9a-f-]{36}$/.test(body.conversationId)) fail('Invalid conversation ID.');
  const options = normalizeAudioSettings(body.settings || {});
  const imageId = options.imageModel ?? 'qwen';
  if (!Object.hasOwn(imageOptions,imageId)) fail('Choose Qwen Image 2.1 or FLUX.2-dev for image generation.');
  const videoId = options.videoModel ?? 'ltx25';
  if (!Object.hasOwn(videoOptions, videoId)) fail('Choose LTX-2.5 or Sulphur 2 for video generation.');
  const video = videoOptions[videoId];
  const settings = { imageModel:imageId, imageGuidance:options.imageGuidance??4, musicLyrics: options.musicLyrics ?? '', voice: options.voice ?? 'Ryan', language: options.language ?? 'Auto', voiceStyle: options.voiceStyle ?? '', musicSeconds: options.musicSeconds ?? 120, sfxSeconds: options.sfxSeconds ?? 'auto', width: options.width ?? 1024, height: options.height ?? 1024, steps: options.steps ?? imageOptions[imageId].steps, seed: options.seed ?? -1,
    videoWidth: options.videoWidth ?? 512, videoHeight: options.videoHeight ?? 320, videoSeconds: options.videoSeconds ?? 2, videoModel:videoId, videoFps:options.videoFps ?? video.fps, videoAudio:options.videoAudio === true, web: options.web === true,
    backend: options.backend ?? 'auto', thinking: options.thinking === true };
  if (!Number.isFinite(settings.imageGuidance) || settings.imageGuidance < 1 || settings.imageGuidance > 10) fail('Image guidance must be between 1 and 10.');
  for (const key of ['width', 'height']) if (!Number.isInteger(settings[key]) || settings[key] < 256 || settings[key] > 2048 || settings[key] % 32) fail('Image dimensions must be multiples of 32 between 256 and 2048.');
  if (!Number.isInteger(settings.steps) || settings.steps < 1 || settings.steps > 60) fail('Choose 1–60 image steps.');
  if (!Number.isSafeInteger(settings.seed) || settings.seed < -1 || settings.seed > 2147483647) fail('Seed must be -1 (random) or an integer up to 2147483647.');
  if (!['auto', 'cuda', 'cpu', 'vulkan', 'metal'].includes(settings.backend)) fail('Choose an available image runtime.');
  if (!video.sizes.some(s=>s.width===settings.videoWidth && s.height===settings.videoHeight)) fail('Choose a supported resolution for ' + video.name + '.');
  if (!video.frameRates.includes(settings.videoFps)) fail('Choose a supported frame rate for ' + video.name + '.');
  if (!video.durations.includes(settings.videoSeconds)) fail('Choose a supported duration for ' + video.name + '.');
  if(typeof settings.musicLyrics !== 'string' || settings.musicLyrics.length > 10000) fail('Lyrics must be under 10,000 characters.');
  if (!voices.includes(settings.voice) || !languages.includes(settings.language)) fail('Choose a supported voice and language.');
  if (typeof settings.voiceStyle !== 'string' || settings.voiceStyle.length > 1000) fail('Voice style must be under 1,000 characters.');
  if (!Number.isInteger(settings.musicSeconds) || settings.musicSeconds < 5 || settings.musicSeconds > 180) fail('Music duration must be 5–180 seconds.');
  if (settings.sfxSeconds !== 'auto' && (!Number.isInteger(settings.sfxSeconds) || settings.sfxSeconds < 1 || settings.sfxSeconds > 30)) fail('Sound effects must be 1–30 seconds.');
  const attachmentIds = validateAttachmentIds(body.attachmentIds);
  return { attachmentIds, prompt: body.prompt.trim(), mode: body.mode, conversationId: body.conversationId || null, settings };
}
export function routeFallback(text) {
  if (/\b(?:do not|don't|never|without)\s+(?:create|generate|draw|render|make|say|speak|narrate|read|compose|produce|animate)\b/i.test(text)) return 'chat';
  if (/\b(?:code|script|tutorial|how (?:do|can|to)|explain)\b/i.test(text)) return 'chat';
  if (/\b(?:generate|create|make|render|animate)\b[\s\S]{0,100}\b(?:video|clip|animation)\b|^animate\b/i.test(text)) return 'video';
  if (/\b(?:read(?:\s+this)?\s+aloud|say|speak|narrate)\b|\b(?:generate|create|make)\b[\s\S]{0,100}\b(?:speech|voiceover|narration)\b/i.test(text)) return 'speech';
  if (/\b(?:generate|create|make|compose|produce)\b[\s\S]{0,100}\b(?:music|song|track|beat|melody|soundtrack)\b/i.test(text)) return 'music';
  if (/\b(?:generate|create|make|produce)\b[\s\S]{0,100}\b(?:sound|soundscape|ambience|ambient audio|foley|audio effect)\b/i.test(text)) return 'sfx';
  return /\b(?:draw|paint|illustrate)\b|\b(?:generate|create|make|render|design)\b[\s\S]{0,100}\b(?:image|picture|photo|illustration|artwork|wallpaper|poster|logo)\b/i.test(text) ? 'image' : 'chat';
}
