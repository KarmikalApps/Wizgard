const previewSizes = [
  { width:512, height:320, label:'Preview · 512 × 320' },
  { width:512, height:512, label:'Square · 512 × 512' },
  { width:768, height:512, label:'Landscape · 768 × 512' },
  { width:512, height:768, label:'Portrait · 512 × 768' },
];
export const videoOptions = {
  ltx25: { name:'LTX-2.5', managerId:'video', fps:24, frameRates:[24,25,48,50], maxImages:1, audio:true,
    durations:[2,4,6,8,10,12,16,20],
    sizes:[...previewSizes,
      {width:1280,height:720,label:'720p · 1280 × 720'},
      {width:720,height:1280,label:'720p portrait · 720 × 1280'},
      {width:1920,height:1080,label:'1080p · 1920 × 1080'},
      {width:1080,height:1920,label:'1080p portrait · 1080 × 1920'}],
    description:'Two-stage generation with optional synchronized sound. Use text alone or one opening-frame image. HD output uses latent upscaling and a refinement pass.' },
  sulphur: { name:'Sulphur 2', managerId:'sulphur', fps:24, frameRates:[24], maxImages:10, audio:true,
    durations:[2,4,6,8], sizes:previewSizes,
    description:'Generate short clips with optional sound. Use text alone, one opening image, or up to 10 image guides.' },
};
export function videoFrames(seconds, fps) { return Math.ceil(seconds * fps / 8) * 8 + 1; }
export function normalizeVideoSettings(settings, modelId = settings.videoModel) {
  const id = Object.hasOwn(videoOptions, modelId) ? modelId : 'ltx25', model = videoOptions[id];
  const size = model.sizes.find(s=>s.width===settings.videoWidth && s.height===settings.videoHeight) || model.sizes[0];
  return { ...settings, videoModel:id, videoWidth:size.width, videoHeight:size.height,
    videoFps:model.frameRates.includes(settings.videoFps)?settings.videoFps:model.fps,
    videoSeconds:model.durations.includes(settings.videoSeconds)?settings.videoSeconds:2,
    videoAudio:settings.videoAudio === true };
}
export function switchVideoSettings(settings, modelId) {
  const current = {videoWidth:settings.videoWidth,videoHeight:settings.videoHeight,videoFps:settings.videoFps,videoSeconds:settings.videoSeconds,videoAudio:settings.videoAudio};
  const profiles = {...settings.videoProfiles,[settings.videoModel]:current};
  return normalizeVideoSettings({...settings,...(profiles[modelId] || current),videoProfiles:profiles},modelId);
}
