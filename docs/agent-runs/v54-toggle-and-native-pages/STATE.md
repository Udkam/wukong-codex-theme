# V54 toggle and native-page surfaces

Updated: 2026-08-12

## Boundary

- Work only in `E:\Proj\wukong-codex-theme`.
- Fix `Ctrl+Alt+T` so it only toggles the New Task quote and Wukong wordmark; it must never hide or move the composer.
- Remove the solid black horizontal bands on the native Plugins and Scheduled pages while keeping their search controls readable.
- Do not use WMI/CIM, steady-state polling, page reloads, scheduled tasks, broad process termination, or an application restart; bounded one-shot verification is allowed.
- Preserve and do not stage unrelated Bajie work, inactive background assets, prior checkpoints, and test artifacts.

## Verified facts

- The canonical checkout is `E:\Proj\wukong-codex-theme`; `main` and `origin/main` are at `829601f` at task start.
- Existing V53 work is committed and pushed. The remaining dirty files belong to the separate Bajie task and retained evidence.
- At task start, the hidden-state selector in `runtime/forge-background-v13.css` targeted every `[data-forge-mark="1"]::before`.
- Composer paper is itself painted by `.forge-composer-frame::before`, and composer frames carry `data-forge-mark="1"`; therefore the broad hidden-state selector suppresses the composer paper when `Ctrl+Alt+T` is pressed.
- The previous V53 shortcut test checks title and wordmark geometry but does not assert composer pseudo-element paint, so it missed this regression.
- Read-only inspection of installed Codex `26.715.2305.0` identified the shared native `SearchablePageLayout`: its carrier has `sticky top-0 z-30 bg-token-main-surface-primary`, while its `::after` paints a 32 px `from-token-main-surface-primary` fade.
- Plugins and Scheduled use the exact native input IDs `plugins-page-search` and `scheduled-page-search`; their rounded search field has its own background, border and backdrop blur and must remain unchanged.
- The repository's existing ASAR provenance contract locks the installed package directory, size and SHA-256; official structure drift is already a hard failure before these selectors may be reused.

## Changes

- Narrowed the hidden wordmark selector to `[data-testid="home-icon"][data-forge-mark="1"]::before`; the composer keeps its independent paper `::before` when `Ctrl+Alt+T` is pressed.
- Added exact source-backed CSS for the Plugins/Scheduled sticky search carrier and its fade only. The native search field, geometry and interaction are untouched.
- Added V54 regressions for composer paint/geometry, both target pages, native search input use, restore behavior, a decoy sticky carrier that must not become transparent, and late-mounted React replacements.
- Made one-shot `injector --apply` use a non-awaiting CDP transport only for apply, followed by a bounded state verifier. A hidden renderer is now reported as `verified:false,deferred:true` and completes through the existing visibility event; host and restore semantics keep their awaited verification.
- Added a V54 runtime revision to prevent a stale or partial hidden install from satisfying the deferred-state contract.

## Verification

- `node --test --test-name-pattern "V54" tests/background-runtime-v13.test.mjs`: 3 passed, 0 failed.
- `npm run test:runtime-states`: 27 passed, 0 failed.
- `npm run test:lifecycle`: 34 passed, 0 failed.
- `git diff --check` over the seven task paths: passed.
- No-reload hot apply to the existing official renderer on port 39696: one target accepted revision `v54-native-pages-and-toggle`; because the renderer was hidden, the result was explicitly `verified:false,deferred:true` rather than timing out. Live CSS identity confirms the exact T selector and both native-page rules are present, with the broad selector absent.
- Repository adapter audit remains `verified=true`, `sourceMode=repository-live`; next managed startup reads this checkout directly, so no reinstall or restart is needed for persistence.

## Single next step

Commit and push only the seven V54 task paths, preserving unrelated Bajie/background/checkpoint work.
