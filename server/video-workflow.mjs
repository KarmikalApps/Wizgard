export function buildVideoWorkflow({ checkpoint, encoder, lora, prompt, seed, width, height, frames, fps = 24, audio = true, sourceImages = [], outputId }) {
  const n = (class_type, inputs) => ({ class_type, inputs });
  const graph = {
    '1': n('CheckpointLoaderSimple', { ckpt_name: checkpoint }),
    '2': n('LoraLoaderModelOnly', { model: ['1', 0], lora_name: lora, strength_model: 0.7 }),
    '3': n('LTXAVTextEncoderLoader', { text_encoder: encoder, ckpt_name: checkpoint, device: 'default' }),
    '4': n('CLIPTextEncode', { clip: ['3', 0], text: prompt }),
    '5': n('CLIPTextEncode', { clip: ['3', 0], text: 'blurry, static frame, distorted motion, watermark, text overlay' }),
    '6': n('LTXVConditioning', { positive: ['4', 0], negative: ['5', 0], frame_rate: fps }),
    '7': n('EmptyLTXVLatentVideo', { width, height, length: frames, batch_size: 1 }),
    '8': n('LTXVAudioVAELoader', { ckpt_name: checkpoint }),
    '9': n('LTXVEmptyLatentAudio', { frames_number: frames, frame_rate: fps, batch_size: 1, audio_vae: ['8', 0] }),
    '10': n('LTXVConcatAVLatent', { video_latent: ['7', 0], audio_latent: ['9', 0] }),
    '11': n('RandomNoise', { noise_seed: seed }),
    '12': n('CFGGuider', { model: ['2', 0], positive: ['6', 0], negative: ['6', 1], cfg: 1 }),
    '13': n('KSamplerSelect', { sampler_name: 'euler' }),
    '14': n('LTXVScheduler', { steps: 8, max_shift: 4, base_shift: 1.5, stretch: true, terminal: 0.1, latent: ['7', 0] }),
    '15': n('SamplerCustomAdvanced', { noise: ['11', 0], guider: ['12', 0], sampler: ['13', 0], sigmas: ['14', 0], latent_image: ['10', 0] }),
    '16': n('LTXVSeparateAVLatent', { av_latent: ['15', 0] }),
    '17': n('VAEDecodeTiled', { samples: ['16', 0], vae: ['1', 2], tile_size: 256, overlap: 64, temporal_size: 32, temporal_overlap: 8 }),
    '19': n('CreateVideo', { images: ['17', 0], fps, ...(audio ? { audio: ['18', 0] } : {}) }),
    '20': n('SaveVideo', { video: ['19', 0], filename_prefix: outputId, format: 'mp4', 'format.codec': 'h264', 'format.codec.encoding': 'auto' }),
  };
  if (audio) graph['18'] = n('LTXVAudioVAEDecode', { samples: ['16', 1], audio_vae: ['8', 0] });
  if (sourceImages.length === 1) {
    graph['21'] = n('LoadImage', { image: sourceImages[0] });
    graph['22'] = n('LTXVImgToVideoInplace', { vae: ['1', 2], image: ['21', 0], latent: ['7', 0], strength: 1, bypass: false });
    graph['10'].inputs.video_latent = ['22', 0];
  } else if (sourceImages.length > 1) {
    let positive = ['6', 0], negative = ['6', 1], latent = ['7', 0];
    sourceImages.forEach((image, index) => {
      const load = String(30 + index * 2), guide = String(31 + index * 2);
      graph[load] = n('LoadImage', { image });
      graph[guide] = n('LTXVAddGuide', { positive, negative, latent, vae: ['1', 2], image: [load, 0], frame_idx: Math.round(index * (frames - 1) / (sourceImages.length - 1)), strength: 1 });
      positive = [guide, 0]; negative = [guide, 1]; latent = [guide, 2];
    });
    Object.assign(graph['12'].inputs, { positive, negative });
    graph['10'].inputs.video_latent = latent;
    graph['60'] = n('LTXVCropGuides', { positive, negative, latent: ['16', 0] });
    graph['17'].inputs.samples = ['60', 2];
  }
  return graph;
}

export function findVideoOutput(outputs) {
  for (const value of Object.values(outputs || {})) {
    if (value && typeof value === 'object') {
      if (typeof value.filename === 'string' && /\.(mp4|webm)$/i.test(value.filename) && value.type === 'output') return value;
      const nested = findVideoOutput(value); if (nested) return nested;
    }
  }
  return null;
}
