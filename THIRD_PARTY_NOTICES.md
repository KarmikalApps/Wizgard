# Third-party attribution

Wizgard is an independent interface developed by **Karmikal Apps**. Its MIT license covers its original code. Model weights, downloaded runtimes, dependencies, and upstream documentation keep their respective licenses and copyright notices.

## Models

| Component | Publisher / source | License |
| --- | --- | --- |
| Qwen Image 2.1 uncensored GGUF | [0xSojalSec](https://huggingface.co/0xSojalSec/Qwen-Image-2.1-Uncensored-GGUF), based on Qwen Image 2.1 | [Qwen Research License](https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE) |
| Qwen3.8 27B Aggressive GGUF | [HauhauCS](https://huggingface.co/HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF), based on Qwen3.8 | Apache 2.0 as declared by the publisher; [base license](https://huggingface.co/Qwen/Qwen3.8-27B/blob/main/LICENSE) |
| Qwen3 VL 8B GGUF image text encoder | [Qwen](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF) | Apache 2.0 |
| Qwen Image 2.1 VAE | [Comfy-Org](https://huggingface.co/Comfy-Org/Qwen-Image-2.1) | Qwen Research License |

**Qwen Image 2.1 is licensed for non-commercial research or evaluation. Commercial use requires a separate license from its licensor.** Wizgard's MIT license does not grant additional rights to those weights. Review the publishers' current terms before use or redistribution, especially after an automatic model update.

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
