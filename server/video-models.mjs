import { videoOptions } from '../src/video-options.mjs';
export const videoModels = {
  ltxuc:{...videoOptions.ltxuc,ids:['ltxuc-transformer','ltxuc-encoder','ltxuc-vae','ltxuc-audio-vae','ltxuc-upscaler'],catalog:{catalogFile:'optional-model-manifest.json',stateFile:'models/optional-installed.json'}},
  ltx25: { ...videoOptions.ltx25,
    ids: ['ltx-transformer','ltx-encoder','ltx-vae','ltx-audio-vae','ltx-upscaler'],
    catalog: { catalogFile:'video-model-manifest.json',stateFile:'models/ltx25-installed.json' } },
  sulphur: { ...videoOptions.sulphur,
    ids: ['video','video-lora','video-encoder'],
    catalog: { catalogFile:'sulphur-model-manifest.json',stateFile:'models/video-installed.json' } },
};
export function videoModel(id = 'ltx25') {
  if (!Object.hasOwn(videoModels,id)) throw new Error('Choose an available video model.');
  return videoModels[id];
}
