Wukong Codex Theme 0.14.7

CURRENT V53 ORDERED 20-BACKGROUND GALLERY

This package themes the official Windows ChatGPT/Codex desktop application. It does not patch ChatGPT.exe, app.asar, WindowsApps, the application signature, or the official Codex profile, and it does not create a separately named Wukong launcher.

INSTALL AND START

1. Exit ChatGPT completely before the first managed launch, including its tray/background instance.
2. Run install-theme.cmd once from this repository-backed package.
3. Run start-theme.cmd. The visible process and window remain the official ChatGPT application.
4. After installation, use the Start Menu entry named ChatGPT with the official icon. Normal task switching and tray restore do not require a restart.
5. If the Store package updates or repairs its shortcut, run install-theme.cmd again.

BACKGROUND CONTRACT

The runtime keeps a 20-image gallery (13 battle + 7 scenery) in two explicit playback sequences. A slot is the stable physical identity; order is the independent position inside its group:

B07 -> B01 -> B02 -> B03 -> B04 -> B05 -> B08 -> B09 -> B06 -> B11 -> B12 -> B15 -> B16
S05 -> S04 -> S08 -> S01 -> S02 -> S03 -> S10

Ctrl+Alt+F advances the currently visible sequence and Ctrl+Alt+B moves back. New Task pages automatically use the battle sequence; project/thread pages automatically use the scenery sequence. Ctrl+Alt+C temporarily overrides that choice on the current page only. Entering another task, thread, or page restores its automatic default without advancing the sequence. The shortcuts do not reload the document or page, reload/rebuild the theme, or replace the theme DOM. There is no automatic or timer-based image rotation, steady poll, WMI/CIM query, service, or scheduled task.

Background images are not filtered. New Task pages apply a fixed 10% full-screen veil (90% of the original image remains visible). Project/thread pages use a separately calibrated per-image threadVeil so bright and dark assets remain readable without one global value flattening every image. The calibration follows the image and page type, not the battle/scenery sequence. The composer, content surface, persistent sidebar, and the temporary flyout shown from a collapsed sidebar all retain the translucent theme treatment.

Ctrl+Alt+T hides or shows both the New Task quote “此去，欲破何局？” and the “悟空” wordmark in place. The preference survives background, task and thread changes in the current window and a no-reload hot apply; a new application process starts with both visible. It does not change the native title node, geometry, background selection or decode state.

The renderer decodes the exact DOM img that will be painted, while the old image remains visible. It keeps one steady background texture, at most two textures during the 420 ms transition, and only one in-flight decode. Hidden pages coalesce a pending request and decode after visibility returns.

CUSTOM BACKGROUNDS

Run backgrounds.cmd without arguments for the interactive manager, or use list, add, replace, move and remove commands. Targets accept a stable slot or scene id. Move changes only the contiguous order inside the group; it never renames a slot, id or asset. Add allocates an unused physical slot. Remove unlinks a scene from rotation but retains its image. Manifest and overwritten-asset backups are written under .wukong-runtime\background-backups. The manager calls scripts\prepare-background.ps1 for deterministic conversion without changing the source image, upscaling it, or exceeding the default 1920x1080 JPEG at quality 90. Add or replace accepts -ThreadVeil 0..1 to calibrate that image on project/thread pages; for example: backgrounds.cmd replace -Target B05 -InputPath "D:\Pictures\my.jpg" -ThreadVeil 0.42 -Force. See README.md for commands, optional crop parameters and the 48,000,000 decoded-pixel budget.

After replacing a background, run stop-theme.cmd and then start-theme.cmd to reload the same reusable official renderer. If no reusable managed channel remains, exit ChatGPT completely and start it once through the managed ChatGPT entry.

LIFECYCLE AND RESTORE

The formal daily path is:

Codex embedded Node -> repository bridge -> event-driven lifecycle host -> official ChatGPT

The compiled AUMID activator starts the official application without starting PowerShell, Get-AppxPackage or Add-Type during the daily launch. PowerShell is used only for explicit installation, maintenance, background preparation, or disable commands.

Run stop-theme.cmd or remove-theme.cmd to restore the open renderer to verified native DOM state without terminating ChatGPT. Removing the repository or package.json marker makes the supervisor unregister itself; later launches remain native.

RELEASE SCOPE

releasedPetIds is empty. Pets are deferred and excluded from this release gate. Historical themes, rejected motifs, development tools, tests, docs, and node_modules are excluded from this minimal runtime package.

For full setup, customization, troubleshooting, asset notices, and licensing, read README.md.

Some backgrounds were photographed or captured by the maintainer; others were collected online or supplied by users. Rights in game imagery and other third-party content remain with their respective owners. If you are a rights holder and believe an included asset infringes your rights, email chenlj89@mail2.sysu.edu.cn; the maintainer will review and remove verified infringing material.
