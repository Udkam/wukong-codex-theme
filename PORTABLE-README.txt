Wukong Codex Forge 0.14.7

CURRENT V51.9 ORDERED 22-BACKGROUND GALLERY

This package themes the official Windows ChatGPT/Codex desktop application. It does not patch ChatGPT.exe, app.asar, WindowsApps, the application signature, or the official Codex profile, and it does not create a separately named Wukong launcher.

INSTALL AND START

1. Exit ChatGPT completely before the first managed launch, including its tray/background instance.
2. Run install-theme.cmd once from this repository-backed package.
3. Run start-theme.cmd. The visible process and window remain the official ChatGPT application.
4. After installation, use the Start Menu entry named ChatGPT with the official icon. Normal task switching and tray restore do not require a restart.
5. If the Store package updates or repairs its shortcut, run install-theme.cmd again.

BACKGROUND CONTRACT

The runtime keeps a 22-image gallery (13 battle + 9 scenery) in persistent numbered sequences. Manual switching never shuffles or repeats randomly:

B01 -> B02 -> B03 -> B04 -> B05 -> B06 -> B07 -> B08 -> B09 -> B10 -> B11 -> B12 -> B13
S01 -> S02 -> S03 -> S04 -> S05 -> S06 -> S07 -> S08 -> S09

Ctrl+Alt+B advances the visible mode by one slot, while Ctrl+Alt+Shift+B moves back by one slot. Both shortcuts wrap only within the current battle or scenery sequence. They do not reload the document or page, reload/rebuild the theme, or replace the theme DOM. A real New Task action may auto-advance only after the 20-minute cooldown. Ordinary task/history/hash/stream/resize/mutation activity does not rotate backgrounds. There is no timer rotation, steady poll, WMI/CIM query, service, or scheduled task.

The renderer decodes the exact DOM img that will be painted, while the old image remains visible. It keeps one steady background texture, at most two textures during the 420 ms transition, and only one in-flight decode. Hidden pages coalesce a pending request and decode after visibility returns.

CUSTOM BACKGROUNDS

Run scripts\prepare-background.ps1 with -Slot B01..B13 or S01..S09 and -InputPath. The script accepts B01..B99 and S01..S99 for future manifest expansion. Existing slots require -Force. The script leaves the source file unchanged, does not upscale, and defaults to a maximum 1920x1080 JPEG at quality 90. Optional CropTop/CropRight/CropBottom/CropLeft values remove source-image borders before scaling. Transparent pixels are placed on black. themes\active.json is the only active manifest. Playback order is controlled by each entry's matching slot/order pair; numbering must stay unique and contiguous inside each mode. To add a scene, prepare the next B or S file and append a complete gallery entry. See README.md for examples and the 48,000,000 decoded-pixel budget.

After replacing a background, run stop-theme.cmd and then start-theme.cmd to reload the same reusable official renderer. If no reusable managed channel remains, exit ChatGPT completely and start it once through the managed ChatGPT entry.

LIFECYCLE AND RESTORE

The formal daily path is:

Codex embedded Node -> repository bridge -> event-driven lifecycle host -> official ChatGPT

The compiled AUMID activator starts the official application without starting PowerShell, Get-AppxPackage or Add-Type during the daily launch. PowerShell is used only for explicit installation, maintenance, background preparation, or disable commands.

Run stop-theme.cmd or remove-theme.cmd to restore the open renderer to verified native DOM state without terminating ChatGPT. Removing the repository or package.json marker makes the supervisor unregister itself; later launches remain native.

RELEASE SCOPE

releasedPetIds is empty. Pets are deferred and excluded from this release gate. Historical themes, rejected motifs, development tools, tests, docs, and node_modules are excluded from this minimal runtime package.

For full setup, customization, troubleshooting, asset notices, and licensing, read README.md.

Some background images were collected online or supplied by users. Rights remain with their respective owners. If you are a rights holder and believe an included asset infringes your rights, email chenlj89@mail2.sysu.edu.cn; the maintainer will review and remove verified infringing material.
