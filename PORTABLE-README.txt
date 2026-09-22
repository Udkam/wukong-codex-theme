WUKONG CODEX THEME - LIQUID GLASS / DUAL QUEUE

This repository has one complete deliverable:

1. Local dual-queue runtime
   - Original 10 battle + 3 scenery queues, route selection, shortcuts,
     landing quote and wordmark. It preserves the project’s authored scenes;
     it does not substitute an unrelated mountain illustration.
   - Launches the official ChatGPT only through project start.cmd with
     a loopback CDP channel, or hot-applies to an existing trusted channel.
     It never patches or kills ChatGPT.exe. Exit any unmanaged tray instance first.
   - Apply: node runtime/injector.mjs --apply <port> themes/active.json
   - Restore: node runtime/injector.mjs --restore <port>

   Ordered playback is:
   B07 -> B01 -> B02 -> B04 -> B05 -> B08 -> B09 -> B06 -> B11 -> B16
   S08 -> S05 -> S01

   Ctrl+Alt+F advances the active sequence and Ctrl+Alt+B moves back.
   Ctrl+Alt+C temporarily changes the current page between battle and scenery.
   Ctrl+Alt+K locks the exact visible image and battle/scenery sequence across
   pages. F/B/C remain active while locked and make the manually selected
   background the new locked target; press K again to resume the current page's
   automatic sequence. Ctrl+Alt+T hides or shows both the New Task quote
   “此去，欲破何局？” and the 悟空 wordmark. New Task pages automatically use the
   battle sequence; project/thread pages automatically use the scenery sequence.
   There is no automatic or timer-based image rotation.

The design uses cool liquid-glass surfaces: the scene stays visible while
text, composer, sidebar, menus and dialogs retain high contrast. The selected
sidebar row has no paper texture or image layer.

Only start.cmd is a public command entry.
It resolves the current official Store package on every explicit theme launch.
Native ChatGPT.exe starts normally without automatic theme injection.
No native-shortcut takeover, startup registration or launch supervisor is needed.
Exit an existing unmanaged ChatGPT instance before starting the themed session.
Other .cmd files are retired and excluded from the runtime package.
The manual launcher does not change official update policies.

Light conversation pages use a scene-adaptive white veil (18%-23% for scenery).
New Task pages have no veil in either theme. Settings return retains the decoded background.
