import { videoOptions } from '../src/video-options.mjs';
export const videoModels = {
  ltx25: { ...videoOptions.ltx25,
    ids: ['ltx-transformer','ltx-encoder','ltx-vae','ltx-audio-vae','ltx-upscaler'],
    catalog: { catalogFile:'video-model-manifest.json',stateFile:'models/ltx25-installed.json' } },
  sulphur: { ...videoOptions.sulphur,
    ids: ['video','video-lora','video-encoder'],
    catalog: { catalogFile:'sulphur-model-manifest.json',stateFile:'models/video-installed.json' } },
};
export function videoModel(id = 'ltx25') {
  if (!Object.hasOwn(videoModels,id)) throw new Error('Choose LTX-2.5 or Sulphur 2 for video generation.');
  return videoModels[id];
}
