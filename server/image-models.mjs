import { imageOptions } from '../src/image-options.mjs';
export const imageModels = {
  zimage:{...imageOptions.zimage,ids:['zimage-diffusion','zimage-encoder','zimage-vae'],catalogFile:'optional-model-manifest.json',stateFile:'models/optional-installed.json'},
  qwen:{...imageOptions.qwen,ids:['diffusion','encoder','vae','image-projector'],catalogFile:'model-manifest.json',stateFile:'models/installed.json'},
  flux2:{...imageOptions.flux2,ids:['flux2-diffusion','flux2-encoder','flux2-vae'],catalogFile:'flux2-model-manifest.json',stateFile:'models/flux2-installed.json'},
};
export function imageModel(id='qwen') {
  if(!Object.hasOwn(imageModels,id))throw new Error('Choose an available image model.');
  return imageModels[id];
}
export function buildImageArgs({modelId,files,prompt,settings,destination,referencePaths=[]}) {
  const model=imageModel(modelId);
  if(referencePaths.length>model.maxImages)throw new Error(model.name+' supports up to '+model.maxImages+' image references.');
  const args=['--diffusion-model',files.diffusion,'--llm',files.encoder,'--vae',files.vae,
    '-p',prompt,'-W',String(settings.width),'-H',String(settings.height),'--steps',String(settings.steps),
    '--cfg-scale','1','--sampling-method','euler','--seed',String(settings.seed),
    '--offload-to-cpu','--diffusion-fa','--vae-tiling','-o',destination];
  if(modelId==='zimage')args.push('--flow-shift','3');
  if(modelId==='flux2')args.push('--guidance',String(settings.imageGuidance??4));
  if(referencePaths.length && modelId==='qwen') {
    if(!files.projector)throw new Error('Qwen Image vision component is missing. Install or update it in Manage Models.');
    args.push('--llm_vision',files.projector);
  }
  for(const path of referencePaths)args.push('-r',path);
  return args;
}
