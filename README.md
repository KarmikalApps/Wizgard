<p align="center">
  <img src="public/logo.png" alt="Wizgard logo" width="320" />
</p>

**Local AI chat, images, video, speech, music and sound effects in one workspace.**

An AI Tool developed by **Karmikal Apps** © 2026

**v1.302a**

See the [changelog](CHANGELOG.md) for what is new.

## About Wizgard

Wizgard is a React and Node.js application that brings six local AI capabilities into one conversation. Install only the models you want. **Auto** interprets your prompt and chooses an active model; you can also select a mode explicitly.

| Capability | Model | Example prompt |
| --- | --- | --- |
| Chat and analysis | Qwen3.8 27B, HauhauCS | “Explain this PDF and answer my questions.” |
| Images | Qwen Image 2.1, 0xSojalSec, or FLUX.2-dev | “Create an image of a mountain cabin at sunrise.” |
| Video | LTX-2.5 or Sulphur 2 | “Create a video of a paper boat floating on a pond.” |
| Speech | Qwen3-TTS 1.7B CustomVoice | “Say ‘Welcome to Wizgard’ in a warm voice.” |
| Music | ACE-Step 1.5 Turbo | “Create 30 seconds of peaceful piano music, no vocals.” |
| Sound effects | MOSS SoundEffect v2 | “Generate 10 seconds of rain on a window.” |

- Attach up to **10 files per message**: images, PDFs, DOCX, text and code.
- Generate images from references and animate reference images into short videos.
- Enable optional **Web access** for chat research with source links.
- Manage downloads, updates, activation and uninstalling inside the app.
- Browse the **Generated Library**, with image previews, video/audio players, and **20 creations per page**.
- Choose where new media is saved. Download a copy or reveal the saved original in its folder.
- Use **Clear Workspace** to remove chats, attachments and generated media after confirmation. Models and settings are preserved.

Chat runs through a private Ollama instance. Images use `stable-diffusion.cpp`; video and music use isolated ComfyUI processes. Speech and sound effects have separate Python environments. Generators take turns using GPU memory and exit after each job. No hosted inference subscription or API key is needed. The optional FastMTP sidecar is not enabled.

## Install and run

**Run the launcher for your operating system, then complete the setup inside Wizgard.** Models are selected, downloaded and managed through the interface.

### 1. Download

Download and extract the repository using GitHub’s **Code → Download ZIP**, or clone it:

```bash
git clone https://github.com/KarmikalApps/Wizgard.git
cd Wizgard
```

Use a writable folder. Read the [model license information](#copyright-and-model-licenses) before installing models.

### 2. Start

| Operating system | Launcher |
| --- | --- |
| Windows 10/11, x64 | Run `Run_WIN.cmd` |
| macOS, Apple Silicon or Intel | Run `Run_UNIX_MAC.sh` |
| Linux, x64 or ARM64 | Run `Run_UNIX_MAC.sh` |

The launcher installs the app’s Node.js and JavaScript dependencies, builds the interface when needed, and opens **[http://127.0.0.1:3210](http://127.0.0.1:3210)**. It does **not** automatically install or update model weights. No system-wide Node.js or Ollama installation is required.

### 3. Complete the in-app setup

Once the app opens, follow its setup screen. Model downloads run through the interface. LTX-2.5 additionally requires access to its publisher repository and a local Hugging Face sign-in; see Video settings below.

1. Choose what you want to generate. **Chat is selected by default**; select at least one available capability.
2. Choose **Next** to review your selection and download size.
3. Choose **Install selected models**. Wizgard downloads the selected models and installs their required engines.
4. Wait for installation to finish, then start creating in your workspace.

Downloads show percentage progress; dependency installation and verification have separate status messages. Interrupted downloads can resume. Unsupported capabilities are disabled for the current platform. You can add other models later.

Existing complete installations are detected automatically. Use the **Manage Models** gear at the bottom left to install more models, check/install updates, activate or deactivate models, or uninstall weights after confirmation. Shared engines and generated media are kept when a model is uninstalled. Removing every model returns the app to setup.

Only active models appear in the mode menu. You can use a generator without installing Chat; without Chat, Auto uses simpler keyword routing, and document/image interpretation or automatic lyric writing is unavailable. Choose a mode explicitly for ambiguous prompts. A request for an inactive capability explains which model to enable.

### 4. Create and stop

Use Auto or choose Chat, Image, Video, Speech, Music, or Sound Effects. Writing lyrics or asking how audio generation works remains a chat request. Video requests use the model selected in **Settings → Video generation**. LTX-2.5 and Sulphur 2 both offer optional generated sound. Separate speech/music/effect generations are not automatically mixed into videos.

Speech offers nine preset voices and ten languages: English, Chinese, Japanese, Korean, German, French, Russian, Portuguese, Spanish, and Italian. This integration uses preset voices rather than voice cloning. Music can include lyrics or be instrumental; sound effects support up to 30 seconds. Music is limited to 180 seconds per request in this interface. Music duration is a numeric field in Settings: enter a whole number from **5 to 180 seconds**, with a default of **120 seconds (2 minutes)**. Saved music Auto selections migrate to 120 seconds; existing numeric choices are preserved. Sound effects retain Auto or Custom duration, with Auto estimating timing from the description up to 30 seconds. A duration in the prompt (seconds or minutes) overrides the configured duration within these limits. Speech length follows the spoken text, up to 6,000 characters per request. For exact song lyrics, enter them in Settings or include [Verse]/[Chorus] sections in your prompt; this also works without Chat.

**Keep the Run window open. Closing it or pressing Ctrl+C stops Wizgard and its owned engines.** Closing only the browser tab leaves the app running. On Windows, answer **Y** if asked to terminate the batch job. Settings also includes **Shut down local runtimes**. `Stop-Wizgard.cmd` is an optional fallback.

### Image settings

Choose **Qwen Image 2.1** or **FLUX.2-dev** in **Settings → Image generation**. Both appear during setup and can be installed, updated, activated and uninstalled independently. Auto image requests use the selected image model. Size and steps are remembered separately; FLUX also exposes guidance (default 4) and starts at 28 steps. Both accept up to 10 image references in this integration.

FLUX.2-dev uses a city96 Q4_K_S transformer, an Unsloth Mistral Small 3.2 24B Q4_K_M text encoder and Black Forest Labs' VAE, all running locally through stable-diffusion.cpp. The package is approximately **34 GB**. Plan for **64 GB RAM and 24–32 GB VRAM**, or a machine with sufficient unified memory; CPU offloading is slower. Start at 512 × 512 before trying larger outputs. These are estimates, not guarantees.

The official FLUX VAE requires repository access. Use your existing Hugging Face sign-in or grant access to [FLUX.2-dev](https://huggingface.co/black-forest-labs/FLUX.2-dev) and set `HF_TOKEN` / use `hf auth login`. Wizgard does not accept publisher terms on your behalf. Review the FLUX model license before installation. Model use is non-commercial unless separately licensed; outputs have separate terms. Review outputs for unlawful or infringing content before sharing. FLUX.2-dev is **not** labeled uncensored.

### Background conversations, Pause and Resume

Open another conversation while a response is being generated. Each conversation keeps its own progress, response and Pause/Resume/Stop controls. Responses continue when switching conversations or closing the browser tab; reopening the app reconnects to unfinished jobs. A sidebar indicator identifies running, queued and paused conversations. Scrolling up preserves your reading position while a response streams; **Jump to latest** resumes following new text. Scroll positions are remembered while switching conversations in the current tab.

Multiple conversations can have pending work at once. The bundled Ollama runtime currently processes this Qwen model architecture **one response at a time**, so chat requests wait in a visible queue. Media generation waits for exclusive engine access so different large models do not compete for memory. Auto requests first use the chat engine to select a capability, then wait for exclusive access when needed. More work can be submitted while other jobs run; the interface explains that processing may be slower. At most 20 unfinished jobs can be queued, with one unfinished response per conversation.

**Pause freezes the owned native engine in memory. Resume continues that same generation; it does not restart it.** Allocated memory remains in use. A chat-engine pause also blocks queued work until Resume or Stop. Queued requests can be paused before they begin. A GPU operation already submitted may finish before the engine becomes idle. Stop ends the selected job; stopping while the engine is paused first resumes it so cancellation can complete. Closing Wizgard itself ends running and paused jobs; pause state is not a checkpoint that survives an app restart.

Hover a sent prompt to reveal **Copy**, which also works during generation, and **Retry** when that conversation is idle. Prompts sent in this version save their mode, model settings and attachment IDs; Retry submits a new turn using that snapshot. Earlier prompts whose settings were not recorded offer an explicit choice to use current settings. Retrying continues the conversation with its current history, so results can differ even when settings match (a random seed remains random).

### Generation Queue

Open **Generation Queue** in the sidebar to see running, waiting and paused requests across conversations. Move waiting jobs up or down without interrupting the active job, open their conversations, or Pause, Resume and Stop them. Cards show elapsed time, active processing time and available progress.

Waiting and remaining time estimates learn from recent completed jobs with similar settings on this computer. **Learning** means there is not yet enough history. Estimates are approximate: prompt complexity and model loading affect timing. Paused time is excluded; queued work waits while an engine is frozen. Timing history is stored locally.

### Completion notifications

**Settings → Completion notifications** is **disabled by default**. Enable it to choose an **OS notification**, a gentle two-tone **ding**, or both. You can adjust the volume, test the alert and choose whether failures also notify. Stopped jobs stay silent. Clicking an OS notification opens its conversation.

OS notifications require your browser's permission and may be affected by system notification settings. Keep a Wizgard tab open, including in the background; notifications do not run after every tab is closed. Sound may require an interaction with the page after reopening it. Preferences are saved in this browser, and supported browsers coordinate open tabs to avoid duplicate alerts.

### Resource usage

The **Resource Usage** icon at the lower left toggles an animated black-and-green usage bar, **off by default**. It samples approximately every two seconds while visible. CPU and RAM cover the app server and its child model engines. CPU is normalized to total machine capacity; RAM sums resident/working-set memory, which can count shared pages more than once. Windows exposes per-process GPU engine counters when available. Otherwise supported NVIDIA systems show **GPU · DEVICE**, meaning the whole device; unavailable values display a dash. Per-app NVIDIA VRAM appears only when the driver reports it. macOS and other GPU drivers may not expose GPU usage through this monitor. No telemetry is sent online.

### Model labels

Setup, Manage Models and Settings show **(Uncensored)** only for variants described that way by their publishers:

- [Qwen 3.8 HauhauCS Aggressive](https://huggingface.co/HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF): a variant intended to reduce refusal behavior.
- [Qwen Image 2.1, 0xSojalSec](https://huggingface.co/0xSojalSec/Qwen-Image-2.1-Uncensored-GGUF): the publisher describes local generation without a pipeline safety checker; these are quantized original weights.
- [Sulphur 2](https://huggingface.co/SulphurAI/Sulphur-2-base): a publisher-described uncensored video model.

The label is **not a promise of no limits**. Refusals, capabilities, hardware requirements and license restrictions still vary. LTX-2.5, FLUX.2-dev and the audio models are not labeled uncensored merely because they run locally or have downloadable weights. An absent label means Wizgard has no verified publisher claim for that variant.

### Video settings

Select **LTX-2.5** or **Sulphur 2** in **Settings → Video generation**. Both can be installed, activated, updated or uninstalled independently in Manage Models. Video mode remains available while either is active.

| Setting | LTX-2.5 | Sulphur 2 |
| --- | --- | --- |
| Output sizes in Wizgard | Preview sizes, 720p and 1080p, landscape or portrait | Preview sizes from 512 × 320 to 768 × 512, plus portrait and square |
| Frame rates | 24, 25, 48 or 50 fps | 24 fps |
| Duration presets | 2–20 seconds | 2–8 seconds |
| Sound | Optional synchronized sound | Optional generated sound |
| Image references | One opening image | Up to 10 guides |

Resolution, frame rate, duration and sound are remembered separately for each model. Auto video requests use the selected model too. Frame counts are rounded to the model's required `8n + 1` structure; Settings shows the resulting duration. LTX-2.5 uses a distilled two-stage pipeline, a learned latent upscaler, and a refinement pass. Final alignment padding is cropped: **1080p saves at exactly 1920 × 1080** (or 1080 × 1920 in portrait).

Higher resolution, frame rates and longer clips require substantially more memory and time. Start with Preview, 2 seconds, 24 fps. HD is a configurable output option, not a guarantee that every GPU can render every combination. LTX-2.5 needs approximately **39.7 GB** of model files; Sulphur 2 needs approximately **39.3 GB**, plus shared engine dependencies.

LTX-2.5 downloads require access to the [official Hugging Face repository](https://huggingface.co/Lightricks/LTX-2.5). Grant access there with your own account, then use an existing `hf auth login` or set `HF_TOKEN` before starting Wizgard. The app also supports `HF_TOKEN_PATH` and `HF_HOME`. Credentials are read from your local environment or Hugging Face sign-in and are never copied into the project or USB installer. After installation, generation is local and works offline.

### Generated Library and output folders

The **Generated Library** button at the top left opens all saved creations, independently of chat history. Filter **All**, **Images**, **Videos**, or **Audio**; pages contain at most **20 items**. Images and videos display their full aspect ratio with no cropping. Prompts are hidden until you choose **Show prompt**; choose **Hide prompt** to collapse them. Videos and audio play directly in their cards. **Remove** deletes an individual generated file after confirmation. **Remove All** deletes every file in the active category across all pages; in All, it removes all generated assets. Missing files are removed from the index when the library refreshes. Chats and model weights are kept; old conversation links to deleted media will no longer open. **Show in folder** reveals the original file; **Download** saves a copy through your browser.

Search prompts and combine category, model, date-range and **Favorites** filters. Dates use UTC; filtering happens before pagination. Star an asset to keep it in Favorites. **Remove All** still applies to the entire active category, including items hidden by search or other filters, and its confirmation states that scope.

**Settings & seed** shows recorded generation details, including the actual seed when available. **Generate a variation** opens an editable prompt and starts a new conversation with the recorded settings and reference attachments, using a new random seed. The original asset stays in the library. Older assets may have only partial metadata; the interface marks this explicitly. Missing reference attachments must be restored before they can be reused.

In **Manage Models → Generated files location**, enter an absolute folder path and save. New media goes into `Wizgard/images`, `Wizgard/videos`, or `Wizgard/audio` inside that folder. Leave the field empty for the project’s default `data/outputs` location, calculated from the installation folder on that computer. The source-only package contains no saved personal output path. Changing it does not move existing files; the library keeps their original locations. Keep external drives connected when accessing files stored there.

Deleting a conversation does not delete its generated files. **Clear Workspace** removes indexed generated files from all configured locations as well as chats and attachments. It never recursively removes a user-selected output folder or deletes unrelated files there.

### Attachments and references

Use the **paperclip** or drop files into the composer. The limit is **10 files per message**, **20 MB per file**, and **100 MB per upload batch**. Remove a pending attachment with its × button.

| Mode | How images are used |
| --- | --- |
| Chat | Qwen sees the attached images and can describe, compare or answer questions about them. |
| Image | Images are passed directly to Qwen Image as ordered visual references. Explain what to keep or change. |
| Video | LTX-2.5 accepts one opening-frame image. Sulphur 2 accepts an opening frame or up to 10 image guides. Describe the motion to generate. |

PNG, JPEG and WebP are supported. Images are normalized locally to at most 2048 pixels on their longest side; chat uses a smaller visual copy. Generated images have **Use as image reference** and **Animate image** actions.

PDF and DOCX text is extracted locally. Text/code formats include TXT, Markdown, CSV, JSON, JavaScript, TypeScript, Python, HTML, CSS, XML, YAML, SQL, shell scripts and INI. Extraction is limited to 500 PDF pages / 500,000 characters per file. Long documents use question-relevant excerpts within the model context; the model is told when it has only excerpts. Scanned PDFs need page screenshots attached as images; automatic OCR is not included. With Chat active, documents can also supply a creative brief for generation or text for narration.

### Optional web access

Turn on the **globe** in the composer or **Web access** in Settings. The local chat model can search, read a result, or follow a public link, with up to three research steps per answer. Sources distinguish pages read from search snippets. Access is off by default.

Search queries go to DuckDuckGo (with a Bing fallback) and page requests go to the selected websites. Attachment contents are not supplied to the web planner. Browsing uses an isolated, script-free browser with a plain-HTML fallback, without your personal browser profile. It cannot sign in, submit forms, access local/private network services or reliably read sites requiring JavaScript, authentication or anti-bot verification. Search availability depends on the provider and its terms.

Wizgard listens on your computer's loopback interface. Its Ollama instance uses port `11435`, leaving a normal Ollama installation on port `11434` separate. The private video engine uses port `8189`; music uses `8190`, only during generation. While Wizgard is running, `Open-Ollama.cmd` opens its chat model in the Windows Ollama CLI. An Ollama-compatible client can use `http://127.0.0.1:11435` and model `wizgard-qwen3.8:latest`.

## Model downloads and updates

The app checks Hugging Face on launch and when you choose **Check for updates**. The model manager reports **Up to date**, **Update available**, or **Unable to check**. Downloads happen only when you choose Install or Update. Configured model files:

| Purpose | Publisher | Selected file | Approximate size |
| --- | --- | --- | --- |
| Chat | [HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF](https://huggingface.co/HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF) | Aggressive Q4_K_P | 17.92 GB |
| FLUX.2-dev image model | [city96/FLUX.2-dev-gguf](https://huggingface.co/city96/FLUX.2-dev-gguf), based on Black Forest Labs | Q4_K_S | 19.30 GB |
| FLUX text encoder | [Unsloth Mistral Small 3.2 24B](https://huggingface.co/unsloth/Mistral-Small-3.2-24B-Instruct-2506-GGUF) | Q4_K_M | 14.33 GB |
| FLUX VAE | [Black Forest Labs](https://huggingface.co/black-forest-labs/FLUX.2-dev) | ae.safetensors | 0.34 GB |
| Image generation | [0xSojalSec/Qwen-Image-2.1-Uncensored-GGUF](https://huggingface.co/0xSojalSec/Qwen-Image-2.1-Uncensored-GGUF) | Q8_0 | 7.59 GB |
| Image text encoder | [Qwen/Qwen3-VL-8B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF) | Q8_0 | 8.71 GB |
| Image VAE | [Comfy-Org/Qwen-Image-2.1](https://huggingface.co/Comfy-Org/Qwen-Image-2.1) | BF16 VAE | 0.68 GB |
| Chat vision projector | HauhauCS (same chat repository) | BF16 mmproj | 0.93 GB |
| Image reference projector | Qwen (same encoder repository) | F16 mmproj | 1.16 GB |
| LTX-2.5 transformer | [Lightricks/LTX-2.5](https://huggingface.co/Lightricks/LTX-2.5) | Distilled INT8 ConvRot | 21.50 GB |
| LTX-2.5 text encoder | Lightricks (same repository) | Gemma 4 12B with projection, INT8 ConvRot | 15.37 GB |
| LTX-2.5 video/audio VAEs and upscaler | Lightricks (same repository) | Conv video VAE, audio VAE, 2× spatial upscaler | 2.81 GB |
| Alternative video model | [SulphurAI/Sulphur-2-base](https://huggingface.co/SulphurAI/Sulphur-2-base) | FP8 checkpoint and speed adapter | 29.82 GB |
| Sulphur text encoder | [Comfy-Org/ltx-2](https://huggingface.co/Comfy-Org/ltx-2) | Gemma 3 12B FP4 | 9.45 GB |
| Speech | [Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice) | Complete 1.7B CustomVoice snapshot | 4.52 GB |
| Music | [Comfy-Org/ace_step_1.5_ComfyUI_files](https://huggingface.co/Comfy-Org/ace_step_1.5_ComfyUI_files) | ACE-Step 1.5 Turbo all-in-one checkpoint | 10.03 GB |
| Sound effects | [OpenMOSS-Team/MOSS-SoundEffect-v2.0](https://huggingface.co/OpenMOSS-Team/MOSS-SoundEffect-v2.0) | Complete v2 snapshot | 11.23 GB |

Changed files are downloaded from a specific publisher commit and verified with SHA-256 before the new set is activated. Ollama's chat alias is refreshed when its source weight or vision projector changes. Verified, unchanged files are reused; they are not downloaded on every launch.

The check follows the configured filenames and model family; it does not silently switch quantization or install an unrelated new release. Audio snapshots also verify small configuration files against publisher Git blob hashes. An unavailable publisher check reports unknown status and keeps installed models usable. Failed downloads preserve the previously activated model set and can be retried from the manager.

Update downloads may temporarily require space for both old and new weights. Uninstalling a video model removes its catalog-owned files and preserves the other video model. Shared runtimes are kept. The active metadata lives under `models/`. **Clear Workspace does not remove weights.** Core runtime versions are pinned in manifests; JavaScript dependencies are locked in `package-lock.json`. Python environments use pinned engine/PyTorch versions with upstream dependency constraints.

## Required specifications

These are planning estimates for the selected weights, not certified performance guarantees. Memory use depends on image size, context length, backend, and operating system. CPU-only generation can be very slow.

| Resource | Practical minimum | Recommended |
| --- | --- | --- |
| Processor | Modern 64-bit x64 or ARM64 CPU, 4+ cores | 8+ modern cores |
| System / unified memory | 32 GB, with offloading and modest settings; memory pressure is possible | 64 GB or more |
| Graphics | CPU inference is available; compatible drivers are required for GPU acceleration | NVIDIA GPU with 24–32 GB VRAM, or Apple Silicon with 64 GB+ unified memory |
| Free storage | Depends on selection: model sizes above, plus engines, package caches and update headroom | 260–340 GB free on an SSD for all six capabilities and updates |
| Network | Required for first setup and publisher checks | Reliable broadband for large downloads |
| Browser | Current browser supporting streaming fetch | Current Chrome, Edge, Firefox, or Safari |

For audio alone, a planning target is 16 GB RAM and 6–8 GB VRAM for speech, or 32 GB RAM and 12–16 GB VRAM for music/effects. More memory helps with longer output. The current speech/effects integration uses NVIDIA CUDA when available and CPU otherwise; music uses ComfyUI’s supported device backend. CPU generation is much slower. Audio runtime installation is available on Windows, Linux, and Apple Silicon; the pinned PyTorch release does not support Intel macOS.


Local video generation currently requires **Windows or Linux with an NVIDIA CUDA GPU**. Plan for at least 64 GB system RAM and 24 GB VRAM for short clips with offloading; 96 GB RAM and 32 GB VRAM provide more headroom for HD. These are planning estimates, not guaranteed limits. macOS can run the interface and supported non-video models.

### Platform prerequisites

- **Windows:** x64 Windows 10/11, PowerShell, internet access for initial setup, and current graphics drivers. Image installation selects CUDA when NVIDIA tooling is detected; otherwise it downloads a Vulkan engine. CPU fallback is included.
- **macOS:** Apple Silicon or Intel, with an OS supported by the downloaded Node.js and Ollama releases. The supplied image binary targets macOS 26; older compatible systems may require a native build. If prompted, install Apple Command Line Tools with `xcode-select --install`, then run again. Metal acceleration is intended for Apple Silicon.
- **Linux:** a modern glibc-based x64 or ARM64 distribution with Bash, `curl`, and `tar`. Native builds may need a C++ compiler and `make` (for example, `build-essential` on Debian/Ubuntu). System libraries and graphics drivers must support the selected binaries. Alpine/musl and every Linux distribution are not guaranteed to work. ARM64 or incompatible prebuilt image engines use the native build fallback.

The scripts download application dependencies and supported runtimes. Operating system packages, compiler prerequisites, and graphics drivers may still require installation through your OS.

## Portable / USB use

Copy the source-only project to a USB drive, then copy it into a writable folder on the destination computer and run its launcher. The launcher installs app dependencies; choose models in the setup screen for that computer. Use a filesystem that supports files larger than 4 GB, such as exFAT; FAT32 cannot hold these models.

An already-installed folder can carry its downloaded weights with it, subject to their licenses. Moving between operating systems or CPU architectures may require additional runtime downloads and dependency installation. The source-only repository is lightweight; it is not an offline bundle of all weights and system requirements.

## Local data and privacy

| Folder | Contents | Included in Git? |
| --- | --- | --- |
| `models/` | Downloaded weights, Ollama manifests, active model state | No |
| `runtime/` | Downloaded engines, Node.js, archives, package cache | Only the two bootstrap catalogs |
| `node_modules/` | Installed JavaScript dependencies | No |
| `dist/` | Built interface | No |
| `data/` | Chats, attachments, default media output, library index, logs and settings | No |
| Custom output folder | Generated images, videos and audio in its `Wizgard/` subfolder | Outside the repository unless you choose otherwise |
| `_Install/` | Optional prepared USB package | No |

Inference is local. Startup contacts publishers for update metadata; model downloads are user-initiated; Wizgard does not send conversation content to a hosted inference service. With Web access enabled, search queries and public-page requests go online. Your chats, attachments and media are stored locally without application-level encryption. Back them up before using **Clear Workspace**, which permanently removes them after confirmation.

## Troubleshooting and development

- **An update or download fails:** check connectivity and free space, then retry in Manage Models. Unavailable update checks can fall back to installed models; an actual failed update is reported instead of silently claimed successful.
- **Port already in use:** close the existing Wizgard Run terminal. Do not start a second copy on the same ports.
- **Out of memory:** close other large applications, reduce image/video dimensions and duration, or choose CPU mode for images. Larger images can exceed the estimates above.
- **Engine failure:** inspect `data/logs/`. Native build prerequisites and graphics drivers are machine-specific.
- **Integrity check:** use `Verify-Models.cmd` on Windows, or run `node scripts/verify-models.mjs` with the bundled Node executable. This hashes the currently selected weights in full.
- **Rebuild:** `Rebuild-Wizgard.cmd` on Windows, or `npm run build` with the bundled Node/npm environment.

For development with Node.js 24 available on your PATH:

```bash
npm ci
npm test
npm run build
```

Use the Run launcher for normal operation. Running `npm start` directly assumes app dependencies and the interface build are already present; model checks still run in the server. Model sources are in `model-manifest.json`, `flux2-model-manifest.json`, `video-model-manifest.json`, `sulphur-model-manifest.json`, and `audio-model-manifest.json`. Core, video and audio runtimes have separate manifests. Model integration tests require downloaded weights; `npm test` runs the small regression suite without them.

## Copyright and model licenses

**Wizgard © 2026 Karmikal Apps.** The original application code is provided under the [MIT License](LICENSE).

Wizgard is an independent tool that uses third-party models. Karmikal Apps does not own their weights or publisher modifications. Each model and dependency retains its own license and attribution.


| Model or component | License / terms |
| --- | --- |
| HauhauCS Qwen3.8 27B chat model and its vision projector | [Apache 2.0, as declared by the publisher](https://huggingface.co/HauhauCS/Qwen3.8-27B-Uncensored-HauhauCS-Aggressive-MTP-GGUF) |
| 0xSojalSec Qwen Image 2.1 and the associated VAE | [Qwen Research License](https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE) |
| Qwen3 VL 8B image encoder and reference projector | [Apache 2.0](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct-GGUF) |
| FLUX.2-dev, city96 quantization and FLUX VAE | [FLUX Non-Commercial License](licenses/FLUX.2-dev-LICENSE.txt); the [quantizer's bundled license](licenses/FLUX.2-dev-GGUF-LICENSE.txt) and Black Forest Labs attribution also apply. Review current publisher terms. |
| Mistral Small 3.2 24B text encoder, Unsloth GGUF | [Apache 2.0](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506) |
| LTX-2.5 and its supporting components | [LTX-2.x Community License](licenses/LTX-2.5-LICENSE.txt); review the [publisher repository](https://huggingface.co/Lightricks/LTX-2.5) and applicable Gemma terms for the text encoder. |
| Sulphur 2 and supporting LTX components | [Publisher license](licenses/Sulphur-2-LICENSE.txt); the Gemma text encoder also retains its [Gemma Terms of Use](https://ai.google.dev/gemma/terms). |
| Qwen3-TTS 1.7B CustomVoice | [Apache 2.0](licenses/Qwen3-TTS-LICENSE.txt) |
| ACE-Step 1.5 Turbo, packaged by Comfy-Org | [MIT](licenses/ACE-Step-1.5-LICENSE.txt) |
| MOSS SoundEffect v2 | [Apache 2.0](licenses/MOSS-TTS-LICENSE.txt) |

**Qwen Image 2.1 is restricted to non-commercial research or evaluation; commercial use requires a separate license from its licensor.** An MIT-licensed interface does not remove model restrictions. Wizgard downloads weights locally and does not include them in its source package.

Downloaded engines and dependencies retain their own licenses. In particular, the separate ComfyUI engines used for video and music are [GPL-3.0](licenses/ComfyUI-LICENSE.txt). Retain upstream licenses, notices and any required corresponding source when redistributing an installed bundle. Local execution does not guarantee that a model will accept every prompt or produce unrestricted output.

See [third-party attribution](THIRD_PARTY_NOTICES.md), [NOTICE](NOTICE), the [license copies](licenses), and each publisher's current model card for details. Review current terms when downloading updated weights or redistributing an installed bundle. Wizgard is not affiliated with or endorsed by the model publishers.
