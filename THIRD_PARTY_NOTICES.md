# Third-party attribution

Wizgard is an independent interface developed by **Karmikal Apps**. Its MIT license covers its original code. Model weights, downloaded runtimes, dependencies, and upstream documentation keep their respective licenses and copyright notices.

## Models

| Component | Publisher / source | License |
| --- | --- | --- |
| Qwen Image 2.1 uncensored GGUF | [0xSojalSec](https://huggingface.co/0xSojalSec/Qwen-Image-2.1-Uncensored-GGUF), based on Qwen Image 2.1 | [Qwen Research License](https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE) |
| Qwen3.8 27B Aggressive GGUF | [HauhauCS](https://huggingface.co/HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF), based on Qwen3.8 | Apache 2.0 as declared by the publisher; [base license](https://huggingface.co/Qwen/Qwen3.8-27B/blob/main/LICENSE) |
| Qwen3 VL 8B GGUF image text encoder | [Qwen](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF) | Apache 2.0 |
| Qwen Image 2.1 VAE | [Comfy-Org](https://huggingface.co/Comfy-Org/Qwen-Image-2.1) | Qwen Research License |

**Qwen Image 2.1 is licensed for non-commercial research or evaluation. Commercial use requires a separate license from its licensor.** Wizgard's MIT license does not grant additional rights to those weights. Review the publishers' current terms before use or redistribution, especially after a model update.

Copies of the Qwen Image agreement, Apache 2.0 text, and publisher model cards are in [licenses](licenses). The required Qwen attribution is retained in [NOTICE](NOTICE). When redistributing downloaded weights, retain their license agreements, attribution, and modification notices. A source-only clone of Wizgard contains no model weights.

## Software

| Component | Purpose | License / notices |
| --- | --- | --- |
| [Node.js](https://github.com/nodejs/node/blob/main/LICENSE) | JavaScript runtime | MIT and bundled third-party notices |
| [Ollama](https://github.com/ollama/ollama/blob/main/LICENSE) | Local chat inference | MIT; bundled libraries retain their own terms |
| [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp/blob/master/LICENSE) | Local image inference | MIT; includes third-party components |
| [React](https://github.com/facebook/react/blob/main/LICENSE), [Vite](https://github.com/vitejs/vite/blob/main/LICENSE) | Interface and build tooling | MIT |
| [react-markdown](https://github.com/remarkjs/react-markdown/blob/main/license), [remark-gfm](https://github.com/remarkjs/remark-gfm/blob/main/license) | Markdown rendering | MIT |
| [Lucide](https://github.com/lucide-icons/lucide/blob/main/LICENSE) | Interface icons | ISC; some inherited icons have MIT notices |
| [CMake](https://cmake.org/licensing/) | Optional native build tooling | BSD 3-Clause and bundled notices |

Transitive packages and GPU libraries have additional notices in their downloaded distributions. Keep those notices with any full offline bundle. Dependencies are recorded in `package-lock.json`; runtime sources and checksums are recorded in `runtime/platform-manifest.json`. Neither file transfers ownership of third-party components to Karmikal Apps.

## Video, attachments and browsing

- **LTX-2.5**: [Lightricks publisher repository](https://huggingface.co/Lightricks/LTX-2.5), [LTX-2.x Community License](licenses/LTX-2.5-LICENSE.txt). The configured distilled INT8 transformer, Gemma 4 text encoder, video/audio VAEs and spatial upscaler retain their publisher terms. The Gemma encoder is also subject to [Gemma Terms of Use](https://ai.google.dev/gemma/terms). Access to the official model repository requires the user's Hugging Face account.
- **Sulphur 2**: [SulphurAI publisher repository](https://huggingface.co/SulphurAI/Sulphur-2-base), [publisher license copy](licenses/Sulphur-2-LICENSE.txt). Its Gemma 3 text encoder retains the Gemma Terms of Use. The application MIT license does not cover model weights.
- **ComfyUI**: separate local video and music processes; [GPL-3.0](licenses/ComfyUI-LICENSE.txt). Its pinned source revision and download are recorded in `video-runtime-manifest.json`. Retain the license and corresponding source when redistributing it.
- **PyTorch**, **uv**, GPU libraries and Python: retain their upstream and bundled license notices. They are downloaded into the private video runtime.
- **PDF.js**, **Playwright**: Apache 2.0; **Mammoth**, **Busboy**, **LinkeDOM**, **ipaddr.js**: MIT; **Sharp**: Apache 2.0 with separately licensed native libraries; **Mozilla Readability**: Apache 2.0. Dependencies and their versions are recorded in `package-lock.json`.
- **Chromium** and the bundled media tooling retain their own notices. Web search uses DuckDuckGo public results with a Bing RSS fallback and is subject to the provider's terms and availability; Wizgard is not affiliated with Microsoft.

The two vision projectors come from the same HauhauCS and Qwen repositories as their associated chat/text encoders and retain those publishers' licenses. No third-party model becomes the property of Karmikal Apps through this integration.


## Audio generation

- **Qwen3-TTS 1.7B CustomVoice**: [Qwen model card](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice) and [Qwen3-TTS source](https://github.com/QwenLM/Qwen3-TTS), Apache 2.0.
- **ACE-Step 1.5 Turbo**: [ACE-Step project](https://github.com/ace-step/ACE-Step-1.5), MIT; [Comfy-Org all-in-one checkpoint](https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files). Its local ComfyUI engine remains GPL-3.0.
- **MOSS SoundEffect v2**: [OpenMOSS model card](https://huggingface.co/OpenMOSS-Team/MOSS-SoundEffect-v2.0) and [MOSS-TTS source](https://github.com/OpenMOSS/MOSS-TTS), Apache 2.0. The pinned sound-effects package includes its own upstream dependencies and notices.
- **Transformers**, **Diffusers**, **Accelerate**, **SoundFile**, **libsndfile**, **descript-audiotools**, **PyTorch** and their transitive dependencies retain their upstream licenses. Keep their distributed notices with a full installed bundle.

Audio sources and immutable revisions are recorded in `audio-model-manifest.json` and `audio-runtime-manifest.json`. Model installation is optional and initiated through the app. None of these models or engines becomes the property of Karmikal Apps.

## FLUX.2-dev

- [Black Forest Labs FLUX.2-dev](https://huggingface.co/black-forest-labs/FLUX.2-dev): 32B image model and VAE, [FLUX Non-Commercial License](licenses/FLUX.2-dev-LICENSE.txt).
- [city96 GGUF quantization](https://huggingface.co/city96/FLUX.2-dev-gguf): Q4_K_S derivative; [bundled license](licenses/FLUX.2-dev-GGUF-LICENSE.txt). The publisher's quantization is a modified format of the base weights, not a model authored by Karmikal Apps.
- [Mistral Small 3.2 24B](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506), [Unsloth GGUF](https://huggingface.co/unsloth/Mistral-Small-3.2-24B-Instruct-2506-GGUF): Apache 2.0 text encoder.

The FLUX model license requires filtering measures or review of outputs before distribution/display/transmission, and applicable AI-generated-content disclosure. This local integration uses manual output review: review generated files before sharing. Model use and generated outputs have distinct license conditions. The application license does not grant commercial model rights. Sources and pinned checksums are recorded in `flux2-model-manifest.json`.
