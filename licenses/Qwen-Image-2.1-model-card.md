---
license: other
license_name: qwen-research
base_model:
  - Qwen/Qwen-Image-2.1
base_model_relation: quantized
pipeline_tag: text-to-image
library_name: gguf
tags:
  - gguf
  - qwen
  - image-generation
  - comfyui
  - comfyui-gguf
---

# Qwen-Image-2.1 Uncensored GGUF

GGUF quantizations of [Qwen/Qwen-Image-2.1](https://huggingface.co/Qwen/Qwen-Image-2.1) for local image generation using the original upstream base weights.

## Benchmark

![Qwen-Image-2.1 benchmark](assets/Qwen-Image-2.1-Benchmark.png)

## GGUF files

| **Quantization** | **File** | **Size** |
| --- | --- | ---: |
| Q8_0 | [**qwen-image-2.1-Q8_0.gguf**](https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF/blob/main/qwen-image-2.1-Q8_0.gguf) | 7.59 GiB |
| Q6_K | [**qwen-image-2.1-Q6_K.gguf**](https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF/blob/main/qwen-image-2.1-Q6_K.gguf) | 5.88 GiB |
| Q5_K_M | [**qwen-image-2.1-Q5_K_M.gguf**](https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF/blob/main/qwen-image-2.1-Q5_K_M.gguf) | 5.22 GiB |
| Q4_K_M | [**qwen-image-2.1-Q4_K_M.gguf**](https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF/blob/main/qwen-image-2.1-Q4_K_M.gguf) | 4.6 GiB |
| Q4_0 | [**qwen-image-2.1-Q4_0.gguf**](https://huggingface.co/abenzerps/Qwen-Image-2.1-Uncensored-GGUF/blob/main/qwen-image-2.1-Q4_0.gguf) | 4.05 GiB |

**Q4_K_M** is recommended for the best balance of size and quality.

## Usage

Use the model with [ComfyUI](https://github.com/comfyanonymous/ComfyUI) and [ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF).

These GGUF files contain the Qwen-Image-2.1 image transformer; the original text encoder and VAE are also required for inference.

1. Download one GGUF file from this repository.
2. Place it in the ComfyUI diffusion models directory.
3. Download the required text encoder and VAE from [Qwen/Qwen-Image-2.1](https://huggingface.co/Qwen/Qwen-Image-2.1).
4. Place them in their corresponding ComfyUI model directories.
5. Load a Qwen-Image-2.1 workflow and select the GGUF model.

```text
ComfyUI/
└── models/
    ├── diffusion_models/
    │   └── qwen-image-2.1-Q4_K_M.gguf
    ├── text_encoders/
    │   └── ...
    └── vae/
        └── ...
```

## Uncensored

These are quantizations of the original Qwen-Image-2.1 weights; no fine-tuning, abliteration, or other weight modification was applied. Local testing found no pipeline-level safety checker or prompt blacklist, and the model generated the tested adult, nudity, violence, and other sensitive categories without observed runtime refusal. Hosted services may apply their own moderation.

## Source and build

- **Source model:** [Qwen/Qwen-Image-2.1](https://huggingface.co/Qwen/Qwen-Image-2.1)
- **Source revision:** `b3179ad355be050328e483a9dfdd9e60cd62adfa`
- **Conversion:** [stable-diffusion.cpp](https://github.com/leejet/stable-diffusion.cpp) commit `1330cebae8f2ba99249df846cc0c9444fcbd4308`
- **License:** Qwen Research License
- **Checksums:** [SHA256SUMS](./SHA256SUMS)
