"""A single offline audio job. Its lifetime is bound to the app process."""
import os, sys, json, threading, time, importlib.util
import psutil
if sys.platform == 'win32':
    torch_lib = os.path.join(os.path.dirname(importlib.util.find_spec('torch').origin), 'lib')
    os.environ['PATH'] = torch_lib + os.pathsep + os.environ.get('PATH', '')
    dll_directory = os.add_dll_directory(torch_lib)
os.environ['TORCHDYNAMO_DISABLE'] = '1'
owner = psutil.Process(int(os.environ['WIZGARD_PARENT_PID']))
started = owner.create_time()
def watch():
    while True:
        time.sleep(1)
        try:
            if not owner.is_running() or owner.create_time() != started: os._exit(0)
        except psutil.Error: os._exit(0)
threading.Thread(target=watch, daemon=True).start()
def event(**value): print('WIZGARD:' + json.dumps(value), flush=True)
with open(sys.argv[1], encoding='utf-8') as f: job = json.load(f)
import torch
import soundfile as sf
device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
dtype = torch.bfloat16 if device.startswith('cuda') else torch.float32
torch.manual_seed(job['seed'])
event(text='Loading ' + job['kind'] + ' model…')
if job['kind'] == 'speech':
    from qwen_tts import Qwen3TTSModel
    model = Qwen3TTSModel.from_pretrained(job['model'], device_map=device, dtype=dtype, attn_implementation='sdpa')
    event(text='Speaking your text…')
    wavs, sr = model.generate_custom_voice(text=job['text'], language=job['language'], speaker=job['voice'], instruct=job['style'], max_new_tokens=8192)
    sf.write(job['output'], wavs[0], sr)
else:
    from moss_soundeffect_v2 import MossSoundEffectPipeline
    pipe = MossSoundEffectPipeline.from_pretrained(job['model'], torch_dtype=dtype, device=device)
    def progress(items, **kwargs):
        total = len(items)
        for i, item in enumerate(items):
            event(text='Generating sound effects…', progress=round(i / total * 100))
            yield item
    audio = pipe(prompt=job['prompt'], seconds=job['seconds'], seed=job['seed'], num_inference_steps=100, cfg_scale=4, sigma_shift=5, progress_bar_cmd=progress)
    sf.write(job['output'], audio[0].detach().float().cpu().numpy().T, pipe.sample_rate)
info = sf.info(job['output'])
event(done=True, seconds=info.duration, sampleRate=info.samplerate, channels=info.channels)
