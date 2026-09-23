// Migrate saved Auto selections, including settings stored on older prompts.
export function normalizeAudioSettings(settings) {
  return {...settings,musicSeconds:settings.musicSeconds==null||settings.musicSeconds==='auto'?120:settings.musicSeconds};
}
