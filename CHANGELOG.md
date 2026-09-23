# Changelog

## v1.302a — 2026-09-23

### New models and generation settings

- Added **FLUX.2-dev** for image generation and reference-based editing alongside Qwen Image 2.1.
- Added **LTX-2.5** for video generation alongside Sulphur 2, with model-specific resolution, frame rate, duration and sound settings, including 720p and 1080p options.
- Added independent installation, activation and removal for the new models, with settings remembered separately for each image/video model.
- Added publisher license copies, attribution and Hugging Face access guidance. “Uncensored” labels identify publisher-described variants and do not promise unrestricted behavior.

### Conversations and Generation Queue

- Continue work in other conversations while requests run or wait in the background.
- Added **Generation Queue** with running, waiting and paused jobs, queue reordering and direct conversation access.
- Added elapsed/processing time and approximate waiting/remaining estimates learned from completed jobs on the current computer.
- Added **Pause/Resume** to freeze owned engines in memory and continue the same generation, alongside Stop.
- Added **Retry** for sent prompts using recorded attachments and settings, and **Copy** even while a response is processing.
- Fixed streaming responses pulling the view to the bottom while reading earlier messages; added **Jump to latest** and per-conversation scroll positions.

### Generated Library

- Added prompt search, model/date filters and persistent favorites, with 20 items per page.
- Added recorded generation settings and actual seed details where available.
- Added **Generate a variation** to reuse recorded settings and references with an editable prompt and a new random seed.
- Improved image/video previews to show the full asset without cropping; prompts can be shown or hidden.
- Added individual removal and **Remove All** for the active category, with confirmation and cleanup of missing file entries.

### Notifications and resource monitoring

- Added optional completion/error notifications with an OS alert and a gentle two-tone ding, individual toggles, adjustable volume and a test button.
- Notifications are **disabled by default**. OS alerts require browser permission; a Wizgard tab must remain open.
- Added the optional **Resource Usage** bar for CPU, RAM and GPU metrics where supported, disabled by default.

### Audio and interface improvements

- Music duration now accepts **5–180 seconds**, defaulting to **120 seconds**. Previous music Auto settings migrate to 120 seconds; existing numeric settings are preserved.
- Sound effects retain Auto/Custom duration, and speech follows the full spoken text.
- Updated the “Set the mood” suggestion without a fixed duration.
- Added a subtle light-purple Matrix background that respects reduced-motion preferences and does not restart when toggling Resource Usage.
- Improved attachment cards with image, document, spreadsheet and code icons, consistent sizing and image preview badges.
- Replaced the workspace letter avatar with a purple robot-head icon.
- Improved model-card alignment, button contrast and footer branding; Karmikal Apps now links to its website.
- Updated setup documentation, model requirements, license notices and the source-only portable installer.

### Usage notes

- Multiple conversations can have pending work, but the bundled Qwen runtime processes one chat response at a time; media generation uses exclusive engine access.
- Paused engines retain memory. Pauses do not survive an app shutdown.
- Timing estimates are approximate and need completed jobs before learning durations.
- Older assets/prompts may lack complete recorded settings. The interface identifies these cases.
- Model weights, dependencies, chats and generated files are excluded from the source package. Third-party model licenses remain separate from Wizgard's MIT license.
