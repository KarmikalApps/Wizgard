// Native ComfyUI two-stage distilled workflow, based on the official LTX-2.5 templates.
export function buildLtx25Workflow({ transformer, encoder, vae, audioVae, upscaler, prompt, seed, width, height, frames, fps=24, audio=false, sourceImages=[], outputId }) {
  if (sourceImages.length > 1) throw new Error('LTX-2.5 supports one opening-frame image in this workflow.');
  const n = (class_type, inputs) => ({class_type,inputs});
  // Both stages require 32-pixel latent alignment. Crop only the final padding.
  const paddedWidth = Math.ceil(width/64)*64, paddedHeight = Math.ceil(height/64)*64;
  const g = {
    '1':n('UNETLoader',{unet_name:transformer,weight_dtype:'default'}),
    '3':n('CLIPLoader',{clip_name:encoder,type:'ltxv',device:'default'}),
    '4':n('CLIPTextEncode',{clip:['3',0],text:prompt}),
    '5':n('CLIPTextEncode',{clip:['3',0],text:'blurry, static frame, distorted motion, watermark, text overlay'}),
    '6':n('VAELoader',{vae_name:vae}),
    '7':n('EmptyLTXVLatentVideo',{width:paddedWidth/2,height:paddedHeight/2,length:frames,batch_size:1}),
    '8':n('VAELoader',{vae_name:audioVae}),
    '9':n('LTXVEmptyLatentAudio',{frames_number:frames,frame_rate:fps,batch_size:1,audio_vae:['8',0]}),
    '10':n('LTXVConcatAVLatent',{video_latent:['7',0],audio_latent:['9',0]}),
    '11':n('RandomNoise',{noise_seed:seed}),
    '12':n('LTXVDualCFGGuider',{model:['1',0],positive:['35',0],negative:['35',1],video_cfg:1,audio_cfg:1}),
    '13':n('KSamplerSelect',{sampler_name:'euler_ancestral'}),
    '14':n('ManualSigmas',{sigmas:'1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0'}),
    '15':n('SamplerCustomAdvanced',{noise:['11',0],guider:['12',0],sampler:['13',0],sigmas:['14',0],latent_image:['10',0]}),
    '16':n('LTXVSeparateAVLatent',{av_latent:['15',0]}),
    '17':n('VAEDecodeTiled',{samples:['26',0],vae:['6',0],tile_size:256,overlap:64,temporal_size:32,temporal_overlap:8}),
    '19':n('CreateVideo',{images:['17',0],fps,...(audio?{audio:['18',0]}:{})}),
    '20':n('SaveVideo',{video:['19',0],filename_prefix:outputId,format:'mp4','format.codec':'h264','format.codec.encoding':'auto'}),
    '21':n('LatentUpscaleModelLoader',{model_name:upscaler}),
    '22':n('LTXVLatentUpsampler',{samples:['16',0],upscale_model:['21',0],vae:['6',0]}),
    '23':n('LTXVConcatAVLatent',{video_latent:['22',0],audio_latent:['16',1]}),
    '24':n('RandomNoise',{noise_seed:(seed+1)%2147483648}),
    '25':n('SamplerCustomAdvanced',{noise:['24',0],guider:['12',0],sampler:['13',0],sigmas:['27',0],latent_image:['23',0]}),
    '26':n('LTXVSeparateAVLatent',{av_latent:['25',0]}),
    '27':n('ManualSigmas',{sigmas:'0.85, 0.7250, 0.4219, 0.0'}),
    '35':n('LTXVConditioning',{positive:['4',0],negative:['5',0],frame_rate:fps}),
  };
  if(audio)g['18']=n('LTXVAudioVAEDecode',{samples:['26',1],audio_vae:['8',0]});
  if(sourceImages.length) {
    g['30']=n('LoadImage',{image:sourceImages[0]});
    g['31']=n('LTXVPreprocess',{image:['30',0],img_compression:18});
    g['32']=n('LTXVImgToVideoInplace',{vae:['6',0],image:['31',0],latent:['7',0],strength:0.7,bypass:false});
    g['33']=n('LTXVImgToVideoInplace',{vae:['6',0],image:['31',0],latent:['22',0],strength:1,bypass:false});
    g['10'].inputs.video_latent=['32',0];g['23'].inputs.video_latent=['33',0];
  }
  if(paddedWidth!==width || paddedHeight!==height) {
    g['34']=n('ImageCrop',{image:['17',0],width,height,x:(paddedWidth-width)/2,y:(paddedHeight-height)/2});
    g['19'].inputs.images=['34',0];
  }
  return g;
}
