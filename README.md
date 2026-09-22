<p align="center">
  <img src="public/logo.png" alt="Wizgard logo" width="320" />
</p>

**Local AI chat and image generation in one workspace.**

An AI Tool developed by **Karmikal Apps** © 2026

**v1.1104a**

## About Wizgard

Wizgard is a React and Node.js application that brings two local AI models into a single chat interface. In **Auto** mode, requests to create images go to Qwen Image; other requests go to Qwen3.8 for text answers. You can also select **Chat** or **Image** explicitly.

- Stream text answers, with optional reasoning display.
- Generate and download images, with size, steps, and seed controls.
- Keep conversations and an image gallery on your computer.
- Switch between models within the same conversation. Models take turns using memory.
- Use **Clear Workspace** to delete all conversations and generated images after confirmation. Models and settings are preserved.
- Run without an API key or hosted inference subscription.

Image generation uses `stable-diffusion.cpp`; chat uses an isolated Ollama instance. The current interface supports text input and image output. The chat model's vision projector and optional FastMTP sidecar are not installed or enabled.

## Install and run

### 1. Download

Download and extract this repository using GitHub's **Code → Download ZIP**, or clone it:

```bash
git clone https://github.com/KarmikalApps/Wizgard.git
cd Wizgard
```

Use a writable folder on a drive with enough free space. Read the [model license information](#copyright-and-model-licenses) before downloading or using the models.

### 2. Start

| Operating system | Command / launcher |
| --- | --- |
| Windows 10/11, x64 | Run `Run_WIN.cmd` |
| macOS, Apple Silicon or Intel | Run `Run_UNIX_MAC.sh` |
| Linux, x64 or ARM64 | Run `Run_UNIX_MAC.sh` |

Run terminal commands from the extracted project folder. The Unix/macOS script detects the operating system and processor automatically.

The launcher downloads the required Node.js runtime, model engines, model weights, and npm dependencies. It builds the interface when needed, starts the app, and displays its address:

**[http://127.0.0.1:3210](http://127.0.0.1:3210)**

The first installation downloads approximately **34.9 GB of model weights**, plus several GB of runtimes and dependencies. Allow time for downloading and checksum verification. Interrupted downloads resume where the publisher supports it. No system-wide Node.js or Ollama installation is required.

### 3. Use and stop

Type a question for a text answer, or a request such as “Generate an image of a mountain cabin at sunrise” for an image. Select **Image** manually if Auto chooses the wrong mode.

**Keep the Run terminal open. Close that terminal or press Ctrl+C to stop the app and the engines it started.** Closing only the browser tab leaves the app running. On Windows, answer **Y** if asked to terminate the batch job. Settings also contains **Shut down local runtimes**. `Stop-Wizgard.cmd` is an optional Windows fallback.

Wizgard listens on your computer's loopback interface. Its Ollama instance uses port `11435`, leaving a normal Ollama installation on port `11434` separate. While Wizgard is running, `Open-Ollama.cmd` opens its chat model in the Windows Ollama CLI. An Ollama-compatible client can use `http://127.0.0.1:11435` and model `wizgard-qwen3.8:latest`.

## Model downloads and updates

Every launch through a Run script checks Hugging Face for the latest revision of **each configured model file**:

| Purpose | Publisher | Selected file | Approximate size |
| --- | --- | --- | --- |
| Chat | [HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF](https://huggingface.co/HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF) | Aggressive Q4_K_P | 17.92 GB |
| Image generation | [0xSojalSec/Qwen-Image-2.1-Uncensored-GGUF](https://huggingface.co/0xSojalSec/Qwen-Image-2.1-Uncensored-GGUF) | Q8_0 | 7.59 GB |
| Image text encoder | [Qwen/Qwen3-VL-8B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF) | Q8_0 | 8.71 GB |
| Image VAE | [Comfy-Org/Qwen-Image-2.1](https://huggingface.co/Comfy-Org/Qwen-Image-2.1) | BF16 VAE | 0.68 GB |

Changed files are downloaded from a specific publisher commit and verified with SHA-256 before the new set is activated. Ollama's chat alias is refreshed when its source weight changes. Verified, unchanged files are reused; they are not downloaded on every launch.

The check follows the same filenames and quantizations, not a different model family or a newly named release. If the publisher cannot be reached, the launcher reports that the latest status is unknown and uses available installed weights. A first installation still needs network access. Failed or corrupt updates stop startup without replacing the previously selected model set.

Previous weight versions are retained for recovery, so updates need extra disk space. The active paths are recorded in `models/installed.json`. **Clear Workspace does not remove weights.** Runtime and npm versions remain pinned by the repository's manifests and lockfile; they do not silently track arbitrary latest releases.

## Required specifications

These are planning estimates for the selected weights, not certified performance guarantees. Memory use depends on image size, context length, backend, and operating system. CPU-only generation can be very slow.

| Resource | Practical minimum | Recommended |
| --- | --- | --- |
| Processor | Modern 64-bit x64 or ARM64 CPU, 4+ cores | 8+ modern cores |
| System / unified memory | 32 GB, with offloading and modest settings; memory pressure is possible | 64 GB or more |
| Graphics | CPU inference is available; compatible drivers are required for GPU acceleration | NVIDIA GPU with 24–32 GB VRAM, or Apple Silicon with 64 GB+ unified memory |
| Free storage | 50 GB for initial setup | 100 GB+ on an SSD for updates and generated images |
| Network | Required for first setup and publisher checks | Reliable broadband for large downloads |
| Browser | Current browser supporting streaming fetch | Current Chrome, Edge, Firefox, or Safari |

### Platform prerequisites

- **Windows:** x64 Windows 10/11, PowerShell, internet access for initial setup, and current graphics drivers. The launcher selects CUDA when NVIDIA tooling is detected; otherwise it downloads a Vulkan engine. CPU fallback is included.
- **macOS:** Apple Silicon or Intel, with an OS supported by the downloaded Node.js and Ollama releases. The supplied image binary targets macOS 26; older compatible systems may require a native build. If prompted, install Apple Command Line Tools with `xcode-select --install`, then run again. Metal acceleration is intended for Apple Silicon.
- **Linux:** a modern glibc-based x64 or ARM64 distribution with Bash, `curl`, and `tar`. Native builds may need a C++ compiler and `make` (for example, `build-essential` on Debian/Ubuntu). System libraries and graphics drivers must support the selected binaries. Alpine/musl and every Linux distribution are not guaranteed to work. ARM64 or incompatible prebuilt image engines use the native build fallback.

The scripts download application dependencies and supported runtimes. Operating system packages, compiler prerequisites, and graphics drivers may still require installation through your OS.

## Portable / USB use

Copy the source-only project to a USB drive, then copy it into a writable folder on the destination computer and run its launcher. Models and dependencies are downloaded for that computer. Use a filesystem that supports files larger than 4 GB, such as exFAT; FAT32 cannot hold these models.

An already-installed folder can carry its downloaded weights with it, subject to their licenses. Moving between operating systems or CPU architectures may require additional runtime downloads and dependency installation. The source-only repository is lightweight; it is not an offline bundle of all weights and system requirements.

## Local data and privacy

| Folder | Contents | Included in Git? |
| --- | --- | --- |
| `models/` | Downloaded weights, Ollama manifests, active model state | No |
| `runtime/` | Downloaded engines, Node.js, archives, package cache | Only the two bootstrap catalogs |
| `node_modules/` | Installed JavaScript dependencies | No |
| `dist/` | Built interface | No |
| `data/` | Conversations, generated images, logs, runtime state | No |
| `_Install/` | Optional prepared USB package | No |

Inference is local. Startup contacts publishers for metadata and downloads; Wizgard does not send conversation content to a hosted inference service. Your chats and images are stored locally without application-level encryption. Back them up before using **Clear Workspace**, which permanently removes them after confirmation.

## Troubleshooting and development

- **An update or download fails:** check connectivity and free space, then run again. Unavailable update checks can fall back to installed models; an actual failed update is reported instead of silently claimed successful.
- **Port already in use:** close the existing Wizgard Run terminal. Do not start a second copy on the same ports.
- **Out of memory:** close other large applications, reduce image dimensions, or choose CPU mode. Larger images can exceed the estimates above.
- **Engine failure:** inspect `data/logs/`. Native build prerequisites and graphics drivers are machine-specific.
- **Integrity check:** use `Verify-Models.cmd` on Windows, or run `node scripts/verify-models.mjs` with the bundled Node executable. This hashes the currently selected weights in full.
- **Rebuild:** `Rebuild-Wizgard.cmd` on Windows, or `npm run build` with the bundled Node/npm environment.

For development with Node.js 24 available on your PATH:

```bash
npm ci
npm test
npm run build
```

Use the Run launcher for normal operation, including setup and model update checks. Running `npm start` directly assumes setup has already completed and skips those checks. Model sources are defined in `model-manifest.json`; runtime sources are defined in `runtime/platform-manifest.json`.

## Copyright and model licenses

**Wizgard © 2026 Karmikal Apps.** The original application code is provided under the [MIT License](LICENSE).

Wizgard is an independent tool that uses third-party **Qwen** models. Karmikal Apps does not own those models, their weights, or the publishers' modifications and quantizations. Their licenses remain separate from Wizgard's license.

**The configured Qwen Image 2.1 materials use the Qwen Research License, which permits non-commercial research or evaluation and requires a separate license for commercial use.** The configured HauhauCS chat model and Qwen3 VL encoder are published under Apache 2.0. An MIT-licensed interface does not remove model restrictions.

See [third-party attribution](THIRD_PARTY_NOTICES.md), [NOTICE](NOTICE), the [license copies](licenses), and each publisher's current model card for details. Review current terms when downloading updated weights or redistributing an installed bundle. Wizgard is not affiliated with or endorsed by the model publishers.
