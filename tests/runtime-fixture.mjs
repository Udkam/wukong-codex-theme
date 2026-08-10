export const nativeUiBaseline = Object.freeze({
  source: 'ChatGPT.exe 26.715.2305.0 app.asar',
  rendererDeviceScaleFactor: 1.25,
  spacing: 4,
  toolbarHeight: 46,
  smallToolbarHeight: 36,
  paneToolbarHeight: 40,
  sidebarPreferredWidth: 275,
  sidebarMinWidth: 240,
  sidebarMaxWidth: 520,
  sidebarViewportReserve: 320,
  sidebarRowHeight: 30,
  sidebarRowRadius: 10,
  threadContentMaxWidth: 768,
  panelPadding: 20,
  toolbarPadding: 16,
  composerButtonSize: 28,
  composerEditorMinHeight: 44,
  composerMultilineRadius: 25,
  composerSingleLineRadius: 22
});

export const runtimeFixtureHtml = String.raw`
  <style>
    :root {
      --spacing: 4px;
      --text-base: 14px;
      --height-toolbar: 46px;
      --height-toolbar-sm: 36px;
      --height-toolbar-pane: 40px;
      --thread-content-max-width: 48rem;
      --spacing-token-sidebar: clamp(240px, 275px, min(520px, calc(100vw - 320px)));
      --spacing-token-button-composer: 28px;
      --spacing-token-button-composer-sm: 28px;
      --spacing-token-button-composer-gap: 4px;
      --padding-row-x: 8px;
      --padding-row-y: 5px;
      --height-token-nav-row: 31px;
      --height-token-row: 30px;
      --radius-token-row: 10px;
      --padding-panel-base: 20px;
      --padding-panel: var(--padding-panel-base);
      --padding-toolbar: 16px;
      --composer-inline-overhang: 24px;
      --home-composer-inline-inset: 13px;
      --composer-adjacent-max-width: 790px;
      --radius-3xl: 25px;
      --radius-token-composer-single-line: 22px;
      --color-token-main-surface-primary: #181818;
      --color-token-side-bar-background: #1c2020;
      --color-token-dropdown-background: #2a2a29;
      --color-token-input-background: #2b2b2a;
      --color-token-foreground: #d8d8d5;
      --color-token-text-secondary: #a5a6a3;
      --color-token-text-tertiary: #7f817e;
      --color-token-icon-foreground: #bfc1bd;
      --color-token-status-warning: #d07a32;
      --color-token-border: rgba(255, 255, 255, .08);
    }

    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; }
    body {
      background: var(--color-token-main-surface-primary);
      color: var(--color-token-foreground);
      font: var(--text-base)/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei UI", sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    button, [contenteditable] { font: inherit; color: inherit; }
    button { border: 0; background: transparent; }
    .icon {
      width: 16px;
      height: 16px;
      flex: 0 0 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.45;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    #root, .app-window { width: 100%; height: 100%; }
    .app-window { display: flex; flex-direction: column; background: #181818; }

    .application-menu {
      position: relative;
      z-index: 60;
      display: flex;
      height: var(--height-toolbar-sm);
      flex: 0 0 var(--height-toolbar-sm);
      align-items: center;
      padding-inline: 0;
      background: #191d1f;
      color: #a3a6a6;
      box-shadow: inset 0 -1px rgba(255, 255, 255, .035);
    }
    .application-menu > .icon { margin-inline: 8px 4px; }
    .application-menu .history { display: flex; gap: 4px; color: #6d7374; }
    .application-menu .application-menu-buttons {
      display: flex;
      align-items: center;
      gap: 2px;
      padding-inline: 4px 8px;
    }
    .application-menu .application-menu-buttons button {
      border: 1px solid transparent;
      padding: 4px 10px;
      color: #a3a6a6;
      background: transparent;
      font: inherit;
      line-height: 1;
    }
    .application-menu .window-controls { margin-left: auto; display: flex; align-items: center; gap: 28px; color: #c7c9c8; }
    .application-menu .window-controls .icon { width: 14px; height: 14px; }

    .app-shell {
      position: relative;
      isolation: isolate;
      display: flex;
      width: 100%;
      min-height: 0;
      flex: 1;
    }

    .app-shell-left-panel {
      position: relative;
      display: flex;
      width: var(--spacing-token-sidebar);
      min-width: var(--spacing-token-sidebar);
      min-height: 0;
      flex-direction: column;
      overflow: hidden;
      background: var(--color-token-side-bar-background);
      box-shadow: inset -1px 0 rgba(255, 255, 255, .045);
    }
    .sidebar-header {
      display: flex;
      height: var(--height-toolbar);
      flex: 0 0 var(--height-toolbar);
      align-items: center;
      justify-content: space-between;
      padding: 0 15px;
      color: #d2d4d2;
      font-weight: 650;
    }
    .sidebar-header .brand { display: inline-flex; align-items: center; gap: 3px; }
    .sidebar-header .icon { color: #969b99; }
    .sidebar-scroll {
      --height-token-row: 30px;
      --radius-token-row: 10px;
      min-height: 0;
      flex: 1;
      overflow: hidden;
      padding: 0 var(--padding-row-x) 72px;
    }
    .sidebar-nav { display: flex; height: 100%; flex-direction: column; gap: 4px; }
    .sidebar-row,
    [data-app-action-sidebar-project-row],
    [data-app-action-sidebar-thread-row] {
      position: relative;
      display: flex;
      width: 100%;
      height: var(--height-token-row);
      min-height: var(--height-token-row);
      align-items: center;
      gap: 8px;
      padding: 0 var(--padding-row-x);
      border-radius: var(--radius-token-row);
      color: #b9bcba;
      text-align: left;
      white-space: nowrap;
    }
    .sidebar-row:hover,
    [data-app-action-sidebar-project-row]:hover,
    [data-app-action-sidebar-thread-row]:hover { background: rgba(255, 255, 255, .04); }
    .sidebar-row .icon,
    [data-app-action-sidebar-project-row] .icon,
    [data-app-action-sidebar-thread-row] .icon { color: #999f9c; }
    .sidebar-row .sidebar-main-action {
      display: flex;
      min-width: 0;
      flex: 1;
      align-items: center;
      gap: 8px;
      color: inherit;
      text-align: left;
    }
    .sidebar-row .sidebar-trailing-action {
      display: flex;
      width: 20px;
      height: 20px;
      flex: 0 0 20px;
      align-items: center;
      justify-content: center;
      color: inherit;
    }
    .native-status-slot {
      display: flex;
      width: 20px;
      height: 20px;
      margin-left: auto;
      flex: 0 0 20px;
      align-items: center;
      justify-content: center;
    }
    .native-status-slot .animate-spin {
      display: inline-flex;
      width: fit-content;
      height: fit-content;
      animation: fixture-spin 2s linear infinite;
    }
    .native-status-slot svg { width: 12px; height: 12px; }
    @keyframes fixture-spin { to { transform: rotate(360deg); } }
    .sidebar-section {
      margin: 18px 8px 6px;
      color: #6e7370;
      font-size: 12px;
      font-weight: 600;
    }
    [data-app-action-sidebar-section] { overflow: hidden; }
    [data-app-action-sidebar-project-row] {
      padding-left: var(--padding-row-x);
      color: #c4c6c3;
      font-weight: 560;
    }
    [data-app-action-sidebar-project-list-id] [data-app-action-sidebar-thread-row] {
      padding-inline: 30px var(--padding-row-x);
    }
    [data-app-action-sidebar-section-heading="Tasks"] [data-app-action-sidebar-thread-row] {
      padding-inline: var(--padding-row-x);
    }
    [data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active="true"] {
      background: #303332;
      color: #e1e2df;
    }
    .sidebar-footer {
      position: absolute;
      inset: auto 0 0;
      display: flex;
      height: 43px;
      align-items: center;
      gap: 9px;
      padding: 0 15px;
      background: linear-gradient(transparent, #1c2020 28%);
      color: #c6c8c5;
      box-shadow: inset 0 1px rgba(255, 255, 255, .035);
    }
    .avatar { width: 18px; height: 18px; border-radius: 50%; background: linear-gradient(135deg, #68a4c8, #d59c5d 58%, #8c6aa3); }
    .sidebar-footer .help { margin-left: auto; color: #767c79; }

    .main-surface {
      position: relative;
      isolation: isolate;
      display: flex;
      min-width: 0;
      min-height: 0;
      flex: 1;
      flex-direction: column;
      overflow: hidden;
      background: var(--color-token-main-surface-primary);
    }
    .app-thread-header {
      position: absolute;
      inset: 0 0 auto;
      z-index: 30;
      display: grid;
      height: var(--height-toolbar);
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 16px;
      padding: 0 var(--padding-toolbar);
      background: #1d1d1d;
      box-shadow: inset 0 -1px rgba(255, 255, 255, .045);
    }
    .thread-heading { display: flex; min-width: 0; align-items: center; gap: 8px; color: #bec1be; }
    .thread-heading .title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .thread-actions { display: flex; align-items: center; gap: 6px; }
    .toolbar-button {
      display: inline-flex;
      min-height: 30px;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 4px 8px;
      border-radius: 9px;
      color: #bfc1be;
    }
    .toolbar-button:hover { background: rgba(255, 255, 255, .055); }

    .app-shell-main-content-viewport {
      position: relative;
      display: flex;
      min-width: 0;
      min-height: 0;
      flex: 1;
      flex-direction: column;
    }
    .app-shell-main-content-frame {
      position: relative;
      display: flex;
      min-height: 0;
      flex: 1;
      flex-direction: column;
      margin-top: var(--height-toolbar);
    }
    .main-content-stack, .route-host { position: relative; width: 100%; height: 100%; min-height: 0; }
    .app-shell-main-content-top-fade {
      pointer-events: none;
      position: absolute;
      inset: 0 0 auto;
      z-index: 20;
      height: 16px;
      background: linear-gradient(#181818, transparent);
      opacity: 0;
    }

    .landing-native {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 0 32px 138px;
      text-align: center;
    }
    .landing-hero { width: min(100%, var(--thread-content-max-width)); min-width: 0; padding-inline: 20px; }
    .landing-hero small { color: #94958f; letter-spacing: .08em; }
    .landing-hero h1,
    .landing-hero .heading-xl { margin: 13px 0 8px; color: #e2e2df; font-size: 30px; line-height: 1.25; font-weight: 420; }
    .landing-hero p { margin: 0; color: #9c9e9a; }

    [data-thread-find-target="conversation"] {
      width: min(100%, var(--thread-content-max-width));
      height: 100%;
      margin: 0 auto;
      overflow: hidden;
      padding: 32px var(--padding-toolbar) 164px;
    }
    .conversation-status {
      display: flex;
      align-items: center;
      gap: 7px;
      margin: 72px 0 14px;
      padding-bottom: 9px;
      border-bottom: 1px solid rgba(255, 255, 255, .08);
      color: #8e908c;
      font-size: 13px;
    }
    [data-virtualized-turn-content] { margin-bottom: 18px; }
    [data-local-conversation-user-anchor] { display: flex; justify-content: flex-end; }
    [data-user-message-bubble] {
      width: fit-content;
      max-width: 72%;
      padding: 9px 13px;
      border-radius: 20px;
      background: #292a28;
      color: #dddeda;
    }
    [data-local-conversation-final-assistant] { display: flex; flex-direction: column; gap: 0; color: #d1d2ce; }
    [data-local-conversation-final-assistant] p { margin: 0 0 12px; }
    pre {
      margin: 3px 0 2px;
      overflow: hidden;
      padding: 12px 14px;
      border: .5px solid rgba(255, 255, 255, .1);
      border-radius: 10px;
      background: #242524;
      color: #cfd2ce;
      font: 13px/1.55 ui-monospace, "SFMono-Regular", Consolas, monospace;
    }

    .composer-area {
      pointer-events: none;
      position: absolute;
      inset: auto 50% 12px auto;
      z-index: 35;
      width: min(100%, var(--thread-content-max-width));
      padding-inline: var(--padding-toolbar);
      transform: translateX(50%);
    }
    [data-codex-composer-root] {
      min-width: 0;
    }
    [data-native-composer-utility-slot]:empty,
    [data-native-above-stack-slot]:empty,
    [data-above-composer-portal]:empty { display: none; }
    [data-above-composer-portal] {
      position: relative;
      display: grid;
      padding-inline: var(--home-composer-inline-inset);
    }
    .native-composer-utility {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      overflow: visible;
      padding-inline: 8px;
    }
    .native-home-composer-utility {
      position: relative;
      top: 4px;
      display: flex;
      flex-wrap: nowrap;
      align-items: center;
      gap: 8px;
      overflow: hidden;
      margin-inline: var(--home-composer-inline-inset);
      margin-bottom: -18px;
      padding: 6px 6px 27px;
      border-radius: 16px 16px 0 0;
      background: var(--color-token-side-bar-background);
    }
    .native-home-composer-scroll-area {
      min-width: 0;
      flex: 1 1 0%;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .native-home-composer-scroll-inner {
      display: flex;
      width: max-content;
      min-width: 100%;
      align-items: center;
      gap: 4px;
    }
    .native-composer-utility-left {
      display: flex;
      min-width: 0;
      flex: 1 1 0%;
      flex-wrap: nowrap;
      align-items: center;
      gap: 0;
    }
    .native-above-stack-inset {
      position: relative;
      padding-inline: var(--home-composer-inline-inset);
    }
    .native-above-stack-inset.native-collapsed {
      margin-bottom: -1px;
    }
    .native-composer-utility button {
      display: inline-flex;
      height: var(--spacing-token-button-composer);
      align-items: center;
      gap: 5px;
      padding-inline: 8px;
    }
    .native-above-composer-stack {
      display: flex;
      width: 100%;
      flex-direction: column;
    }
    .native-above-composer-row {
      width: 100%;
      min-width: 0;
      border-right: 1px solid var(--color-token-border);
      border-left: 1px solid var(--color-token-border);
      border-top: 1px solid var(--color-token-border);
      background: color-mix(in srgb, var(--color-token-input-background) 70%, transparent);
    }
    .native-above-composer-row:first-child {
      border-radius: 16px 16px 0 0;
    }
    .native-above-composer-content,
    .native-queued-message-content {
      display: flex;
      min-width: 0;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .native-above-composer-content {
      padding: var(--padding-row-y) 12px;
    }
    .native-queued-message-list {
      display: flex;
      max-height: 30dvh;
      flex-direction: column;
      gap: 1px;
      overflow-x: hidden;
      overflow-y: auto;
      padding: var(--padding-row-y) 12px;
    }
    .native-queued-message-wrap {
      overflow: visible;
    }
    .native-queued-message-content {
      padding-block: 2px;
      font-size: var(--text-base);
    }
    .native-progress-host {
      position: relative;
      grid-column-start: 1;
      grid-row-start: 1;
      height: 32px;
      align-self: end;
    }
    .native-progress-layer {
      position: absolute;
      inset-inline: 0;
      bottom: 4px;
      display: flex;
      min-height: 28px;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding-bottom: 4px;
    }
    .native-progress-gradient {
      pointer-events: none;
      position: absolute;
      inset-inline: 0;
      bottom: -4px;
      height: 28px;
      background: linear-gradient(to top, var(--color-token-main-surface-primary), transparent);
    }
    .native-progress-rail {
      display: flex;
      width: 100%;
      max-width: var(--thread-content-max-width);
      min-width: 0;
      justify-content: center;
    }
    .native-progress-clip {
      position: relative;
      z-index: 10;
      max-width: 100%;
      min-width: 0;
      overflow: hidden;
      border-radius: 24px;
    }
    .native-progress-pill {
      display: flex;
      width: max-content;
      max-width: 100%;
      min-width: 0;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 6px 12px;
      border: 1px solid var(--color-token-border);
      border-radius: 24px;
      background: color-mix(in srgb, var(--color-token-input-background) 70%, transparent);
      white-space: nowrap;
    }
    .composer-surface-chrome {
      pointer-events: auto;
      position: relative;
      display: flex;
      width: 100%;
      flex-direction: column;
      overflow: hidden;
      border-radius: var(--radius-3xl);
      background: var(--color-token-input-background);
      box-shadow: 0 0 0 .5px rgba(255, 255, 255, .085), 0 10px 24px rgba(0, 0, 0, .2);
    }
    .composer-input-wrap {
      flex-grow: 1;
      overflow-y: auto;
      margin-bottom: 4px;
      padding-inline: 12px;
    }
    .ProseMirror {
      min-height: 44px;
      outline: 0;
      color: #dbdcd8;
      line-height: 20px;
      white-space: pre-wrap;
    }
    .ProseMirror:empty::before { content: attr(data-placeholder); color: #777a76; }
    .composer-footer {
      display: grid;
      grid-template-columns: minmax(0, auto) auto minmax(0, 1fr);
      align-items: center;
      column-gap: 5px;
      margin-bottom: 8px;
      padding-inline: 8px;
      user-select: none;
    }
    .composer-footer button {
      display: inline-flex;
      height: var(--spacing-token-button-composer);
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 0 8px;
      border-radius: 8px;
      color: var(--color-token-icon-foreground);
      font-size: 12px;
      line-height: 18px;
    }
    .composer-footer-action,
    .composer-footer-actions,
    .composer-footer-controls { display: flex; align-items: center; }
    .composer-footer-actions { flex-shrink: 0; gap: 8px; }
    .composer-footer-controls { min-width: 0; width: 100%; justify-content: flex-end; gap: 5px; }
    .composer-footer .icon-only,
    .composer-footer .send {
      width: var(--spacing-token-button-composer);
      padding: 0;
    }
    .composer-footer button:hover { background: rgba(255, 255, 255, .055); }
    .composer-footer .access { color: var(--color-token-status-warning); }
    .composer-footer .model {
      color: var(--color-token-text-secondary);
    }
    .composer-footer .send {
      border-radius: 50%;
      background: #c8cac6;
      color: #4a4b48;
    }
    .opacity-50 { opacity: .5; }

    .thread-summary-layer {
      pointer-events: none;
      position: absolute;
      inset: 12px 0 12px auto;
      z-index: 40;
      width: 316px;
    }
    [data-pip-obstacle="thread-summary-panel"] {
      pointer-events: auto;
      display: flex;
      max-height: 100%;
      padding-right: 16px;
    }
    .summary-panel-card {
      display: flex;
      width: 300px;
      max-height: 100%;
      flex-direction: column;
      overflow: hidden;
      padding: 11px 14px 9px;
      border-radius: var(--radius-3xl);
      background: var(--color-token-dropdown-background);
      box-shadow: 0 12px 30px rgba(0, 0, 0, .22), 0 0 0 .5px rgba(255, 255, 255, .075);
    }
    .summary-heading-surface {
      position: relative;
      background: #373938;
    }
    .summary-heading-surface::before,
    .summary-native-section-title::before {
      content: "";
      background: #252725;
    }
    .summary-heading { display: flex; align-items: center; margin: 0 0 5px; color: #969894; font-size: 14px; font-weight: 550; }
    .summary-heading button { margin-left: auto; color: #858985; }
    .summary-row {
      display: flex;
      min-height: 42px;
      align-items: center;
      gap: 9px;
      border-bottom: .5px solid rgba(255, 255, 255, .1);
      color: #d2d3cf;
    }
    .summary-row:last-child { border: 0; }
    .summary-row .meta { margin-left: auto; color: #777b78; }
    .summary-native-section {
      position: relative;
      z-index: 0;
      display: flex;
      flex-direction: column;
      padding-bottom: 12px;
    }
    .summary-native-section:last-child { padding-bottom: 2px; }
    .summary-native-section-title {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      width: 100%;
      min-width: 0;
      height: 28px;
      align-items: center;
      gap: 8px;
      padding: 0 10px 2px 14px;
      background: #373938;
      color: #a1a4a0;
      font-size: 14px;
    }
    .summary-native-section-title button {
      min-width: 0;
      padding: 2px 4px 2px 0;
      border: 0;
      background: transparent;
      color: inherit;
    }
    .summary-native-section-body { position: relative; z-index: 0; margin-top: 2px; overflow: hidden; }
    .summary-native-section-list { display: flex; flex-direction: column; gap: 2px; padding: 0 14px; }

    @media (max-width: 720px) {
      .app-shell-left-panel,
      .thread-summary-layer {
        display: none;
      }
    }
  </style>

  <div id="root" class="electron-dark" data-codex-window-type="electron">
    <div class="app-window">
      <header class="application-menu app-header-tint draggable group/application-menu-top-bar"
        data-native-slot="topbar">
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="2"/><path d="M6.5 2.5v11"/></svg>
        <span class="history"><svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m9.5 3.5-4.5 4.5 4.5 4.5M5 8h8"/></svg><svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m6.5 3.5 4.5 4.5-4.5 4.5M11 8H3"/></svg></span>
        <div class="application-menu-buttons flex items-center gap-0.5 pr-2 pl-1">
          <button type="button" aria-expanded="false" aria-haspopup="menu"
            aria-label="文件" data-native-slot="menu-file">文件</button>
          <button type="button" aria-expanded="false" aria-haspopup="menu"
            aria-label="编辑" data-native-slot="menu-edit">编辑</button>
          <button type="button" aria-expanded="false" aria-haspopup="menu"
            aria-label="视图" data-native-slot="menu-view">视图</button>
          <button type="button" aria-expanded="false" aria-haspopup="menu"
            aria-label="帮助" data-native-slot="menu-help">帮助</button>
        </div>
        <span class="window-controls"><svg class="icon" viewBox="0 0 16 16"><path d="M3 8h10"/></svg><svg class="icon" viewBox="0 0 16 16"><rect x="4" y="3" width="8" height="8" rx="1"/><path d="M2.5 5.5h7v8h-7z"/></svg><svg class="icon" viewBox="0 0 16 16"><path d="m4 4 8 8M12 4l-8 8"/></svg></span>
      </header>

      <div class="app-shell">
        <aside class="app-shell-left-panel" data-native-slot="sidebar">
          <div class="sidebar-header"><span class="brand">Codex <svg class="icon" viewBox="0 0 16 16"><path d="m5 6 3 3 3-3"/></svg></span><svg class="icon" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4"/><path d="m10 10 3 3"/></svg></div>
          <div class="sidebar-scroll vertical-scroll-fade-mask" data-app-action-sidebar-scroll>
            <nav class="sidebar-nav" aria-label="Codex navigation">
              <div class="sidebar-row" data-native-slot="new-task-row">
                <button class="sidebar-main-action" aria-label="新建任务" data-native-slot="new-task"><svg class="icon" viewBox="0 0 16 16"><path d="M3 12.5h3l7-7-3-3-7 7v3Z"/><path d="m8.8 3.7 3 3"/></svg>新建任务</button>
                <button class="sidebar-trailing-action" aria-label="新建任务菜单" aria-haspopup="menu"
                  data-state="closed" data-native-slot="new-task-menu">···</button>
              </div>
              <button class="sidebar-row" data-native-slot="pull-requests"><svg class="icon" viewBox="0 0 16 16"><path d="M5 2.5 3 5l2 2.5M11 2.5 13 5l-2 2.5M3 11h10"/></svg>拉取请求</button>
              <button class="sidebar-row" data-native-slot="sites"><svg class="icon" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="4" height="4" rx="1"/><rect x="9.5" y="2.5" width="4" height="4" rx="1"/><rect x="2.5" y="9.5" width="4" height="4" rx="1"/><rect x="9.5" y="9.5" width="4" height="4" rx="1"/></svg>站点</button>
              <button class="sidebar-row" data-native-slot="scheduled"><svg class="icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><path d="M8 5v3l2 1.5"/></svg>已安排</button>
              <button class="sidebar-row" data-native-slot="plugins"><svg class="icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3"/><path d="M8 1.8v3M8 11.2v3M1.8 8h3M11.2 8h3"/></svg>插件</button>
              <section data-app-action-sidebar-section data-app-action-sidebar-section-heading="Tasks">
                <p class="sidebar-section">置顶</p>
                <button class="sidebar-row" data-app-action-sidebar-thread-row><svg class="icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><path d="M8 5v3l2 1.5"/></svg><span data-thread-title>每日通知与时事汇总</span><span class="native-status-slot" data-native-status="unread"><span class="icon-xs relative scale-50"><span class="absolute inset-0 rounded-full" style="display:block;width:8px;height:8px;border-radius:50%;background-color:var(--vscode-textLink-foreground)"></span></span></span></button>
                <button class="sidebar-row" data-app-action-sidebar-thread-row><svg class="icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><path d="M8 5v3l2 1.5"/></svg><span data-thread-title>磁盘审计</span></button>
              </section>
              <section data-app-action-sidebar-section data-app-action-sidebar-section-heading="Projects">
                <p class="sidebar-section">项目</p>
                <div role="button" tabindex="0" aria-disabled="false" data-app-action-sidebar-project-row aria-expanded="true"><svg class="icon" viewBox="0 0 16 16"><path d="M2 4.5h4l1.2 1.5H14v6.5H2z"/></svg>wukong-codex-theme<button type="button" aria-label="项目更多操作" data-app-action-sidebar-project-show-all-toggle data-native-slot="project-internal-control">···</button></div>
                <div data-app-action-sidebar-project-list-id="wukong-codex-theme">
                  <div role="listitem"><div role="button" tabindex="0" aria-disabled="false" aria-roledescription="sortable"><div class="overflow-hidden"><div role="button" tabindex="0" aria-disabled="false" data-app-action-sidebar-thread-row data-app-action-sidebar-thread-active="true" aria-current="page" data-native-slot="project-active"><span data-thread-title>重设计黑神话悟空主题</span><span class="native-status-slot" data-native-status="running"><span class="animate-spin"><svg viewBox="0 0 24 24" fill="none"><path opacity=".3" d="M18 12A6 6 0 1 1 12 6" stroke="currentColor" stroke-width="2"/><path d="M12 4a8 8 0 0 1 8 8" stroke="currentColor" stroke-width="2"/></svg></span></span><button type="button" aria-label="任务更多操作" data-native-slot="project-thread-menu" style="width:20px;height:20px">···</button></div></div></div></div>
                  <div role="listitem"><div role="button" tabindex="0" aria-disabled="false" aria-roledescription="sortable"><div class="overflow-hidden"><div role="button" tabindex="0" aria-disabled="false" data-app-action-sidebar-thread-row data-native-slot="project-wukong-secondary"><span data-thread-title>主题视觉验收</span></div></div></div></div>
                </div>
                <div role="button" tabindex="0" aria-disabled="false" data-app-action-sidebar-project-row aria-expanded="true"><svg class="icon" viewBox="0 0 16 16"><path d="M2 4.5h4l1.2 1.5H14v6.5H2z"/></svg>reproduction-temple-run</div>
                <div data-app-action-sidebar-project-list-id="reproduction-temple-run">
                  <div role="listitem"><div role="button" tabindex="0" aria-disabled="false" aria-roledescription="sortable"><div class="overflow-hidden"><div role="button" tabindex="0" aria-disabled="false" data-app-action-sidebar-thread-row data-native-slot="project-temple-child"><span data-thread-title>接管 Temple 总控并归档修复</span><button type="button" aria-label="任务更多操作" data-native-slot="project-thread-menu" style="width:20px;height:20px">···</button></div></div></div></div>
                </div>
                <div role="button" tabindex="0" aria-disabled="false" data-app-action-sidebar-project-row aria-expanded="false" data-app-action-sidebar-project-collapsed="true"><svg class="icon" viewBox="0 0 16 16"><path d="M2 4.5h4l1.2 1.5H14v6.5H2z"/></svg>reproduction-tetris</div>
              </section>
            </nav>
          </div>
          <div class="sidebar-footer"><span class="avatar"></span><span>4cer</span><svg class="icon help" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><path d="M6.8 6.2A1.5 1.5 0 0 1 8.2 5c1 0 1.8.6 1.8 1.5 0 1.3-2 1.4-2 2.7M8 11.8h.01"/></svg></div>
        </aside>

        <main class="main-surface" role="main" data-native-slot="workspace">
          <div class="app-thread-header app-header-tint" data-native-slot="taskbar">
            <div class="thread-heading"><svg class="icon" viewBox="0 0 16 16"><path d="M2 4.5h4l1.2 1.5H14v6.5H2z"/></svg><span class="title">重设计黑神话悟空主题</span><span>···</span></div>
            <div class="thread-actions"><button class="toolbar-button">打开位置<svg class="icon" viewBox="0 0 16 16"><path d="m5 6 3 3 3-3"/></svg></button><button class="toolbar-button" aria-label="视图设置"><svg class="icon" viewBox="0 0 16 16"><path d="M3 4h10M3 8h10M3 12h10"/><circle cx="6" cy="4" r="1" fill="currentColor"/><circle cx="10" cy="8" r="1" fill="currentColor"/><circle cx="7" cy="12" r="1" fill="currentColor"/></svg></button></div>
          </div>

          <div class="app-shell-main-content-viewport" data-app-shell-main-content-layout="thread-edge-scroll">
            <div class="app-shell-main-content-frame">
              <div class="main-content-stack">
                <div class="app-shell-main-content-top-fade" data-app-shell-main-content-top-fade="hidden"></div>
                <div class="route-host" data-vscode-context='{"chatgpt.supportsNewChatMenu": true}'>
                  <section class="landing-native">
                    <div class="landing-hero">
                      <small>新建任务</small>
                      <div data-testid="home-icon" aria-hidden="true" style="position:relative;width:56px;height:56px;margin:0 auto 12px">
                        <svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="13"/></svg>
                      </div>
                      <div class="heading-xl" data-feature="game-source"><span>我们该构建什么？</span></div>
                      <p>描述目标，Codex 会在当前项目中开始工作。</p>
                    </div>
                  </section>

                  <div class="thread-summary-layer" data-native-slot="right-panel">
                    <div data-pip-obstacle="thread-summary-panel">
                      <section class="summary-panel-card relative flex max-h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-token-dropdown-background pt-2.5" data-native-slot="right-card">
                        <div class="summary-heading-surface bg-token-dropdown-background">
                          <h2 class="summary-heading">环境信息<button aria-label="添加" data-native-slot="right-add" data-slot="thread-summary-panel-icon-button"><svg class="icon" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg></button></h2>
                        </div>
                        <div class="summary-row" data-slot="thread-summary-panel-item"><svg class="icon" viewBox="0 0 16 16"><rect x="3" y="2.5" width="10" height="11" rx="1.5"/><path d="M6 6h4M6 9h4"/></svg><span>变更</span><span class="meta">+0 -0</span></div>
                        <div class="summary-row" data-slot="thread-summary-panel-item"><svg class="icon" viewBox="0 0 16 16"><rect x="2.5" y="3" width="11" height="8" rx="1.5"/><path d="M5 13h6"/></svg><span>本地</span><svg class="icon meta" viewBox="0 0 16 16"><path d="m5 6 3 3 3-3"/></svg></div>
                        <div class="summary-row" data-slot="thread-summary-panel-item"><svg class="icon" viewBox="0 0 16 16"><circle cx="4" cy="3.5" r="1.5"/><circle cx="4" cy="12.5" r="1.5"/><circle cx="12" cy="6" r="1.5"/><path d="M4 5v6M5.5 4.2C9 4.5 8 6 10.5 6"/></svg><b>main</b><svg class="icon meta" viewBox="0 0 16 16"><path d="m5 6 3 3 3-3"/></svg></div>
                        <div class="summary-row" data-slot="thread-summary-panel-item"><svg class="icon" viewBox="0 0 16 16"><circle cx="5" cy="8" r="2"/><circle cx="11" cy="8" r="2"/><path d="M7 8h2"/></svg><span>比较分支</span><svg class="icon meta" viewBox="0 0 16 16"><path d="M5 11 11 5M7 5h4v4"/></svg></div>
                        <section class="summary-native-section relative z-0 flex flex-col pb-3 after:absolute after:inset-x-3.5 after:bottom-0 after:h-[0.5px] after:bg-token-border-default after:content-[''] last:pb-0.5">
                          <header class="summary-native-section-title sticky top-0 z-10 flex h-7 w-full min-w-0 items-center justify-start gap-2 bg-token-dropdown-background ps-3.5 pe-2.5 pb-0.5 text-base text-token-text-tertiary">
                            <button type="button" aria-expanded="true"><span>子智能体</span></button><span style="margin-left:auto">1 运行中</span>
                          </header>
                          <div class="summary-native-section-body relative z-0 mt-0.5 overflow-hidden"><div class="summary-native-section-list flex flex-col gap-0.5 px-3.5">
                            <div class="summary-row" data-slot="thread-summary-panel-item"><svg class="icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2"/></svg><span>视觉审计</span><span class="meta">运行中</span></div>
                          </div></div>
                        </section>
                        <section class="summary-native-section relative z-0 flex flex-col pb-3 after:absolute after:inset-x-3.5 after:bottom-0 after:h-[0.5px] after:bg-token-border-default after:content-[''] last:pb-0.5">
                          <header class="summary-native-section-title sticky top-0 z-10 flex h-7 w-full min-w-0 items-center justify-start gap-2 bg-token-dropdown-background ps-3.5 pe-2.5 pb-0.5 text-base text-token-text-tertiary">
                            <button type="button" aria-expanded="true"><span>后台进程</span></button>
                          </header>
                          <div class="summary-native-section-body relative z-0 mt-0.5 overflow-hidden"><div class="summary-native-section-list flex flex-col gap-0.5 px-3.5">
                            <div class="summary-row" data-slot="thread-summary-panel-item"><svg class="icon" viewBox="0 0 16 16"><rect x="2.5" y="3" width="11" height="9" rx="1.5"/></svg><span>rg 定向检查</span></div>
                          </div></div>
                        </section>
                        <section class="summary-native-section relative z-0 flex flex-col pb-3 after:absolute after:inset-x-3.5 after:bottom-0 after:h-[0.5px] after:bg-token-border-default after:content-[''] last:pb-0.5">
                          <header class="summary-native-section-title sticky top-0 z-10 flex h-7 w-full min-w-0 items-center justify-start gap-2 bg-token-dropdown-background ps-3.5 pe-2.5 pb-0.5 text-base text-token-text-tertiary">
                            <button type="button" aria-expanded="true"><span>来源</span></button><button type="button" aria-label="添加来源" style="margin-left:auto">＋</button>
                          </header>
                          <div class="summary-native-section-body relative z-0 mt-0.5 overflow-hidden"><div class="summary-native-section-list flex flex-col gap-0.5 px-3.5">
                            <div class="summary-row" data-slot="thread-summary-panel-item"><svg class="icon" viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/></svg><span>参考截图</span></div>
                          </div></div>
                        </section>
                      </section>
                    </div>
                  </div>

                  <div class="composer-area" data-thread-find-composer="true">
                    <div class="min-w-0" data-codex-composer-root>
                      <div data-above-composer-portal
                        data-above-composer-conversation-id="fixture"
                        class="relative px-[var(--home-composer-inline-inset)] empty:hidden electron:grid"></div>
                      <div class="relative flex w-full flex-col gap-2">
                        <div data-native-above-stack-slot></div>
                        <div data-native-composer-utility-slot
                          data-fixture-surface="composer-context"
                          class="native-composer-utility flex flex-wrap items-center gap-2 overflow-visible pr-2 pl-2"></div>
                        <div class="composer-surface-chrome composer-native" data-codex-composer data-native-slot="composer">
                          <div class="composer-input-wrap"><div class="ProseMirror" contenteditable="true" role="textbox" aria-label="Message composer" data-placeholder="随心输入"></div></div>
                          <div class="composer-footer select-none _footer_uoylu_2" role="toolbar">
                            <div class="composer-footer-action">
                              <button class="icon-only" data-native-slot="composer-add"
                                data-composer-navigation-target="add-context"
                                aria-label="添加"><svg class="icon" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10"/></svg></button>
                            </div>
                            <div class="composer-footer-actions">
                              <button class="access" data-native-slot="composer-access"
                                data-composer-navigation-target="permissions">完全访问</button>
                            </div>
                            <div class="composer-footer-controls">
                              <button class="model" data-native-slot="composer-model"
                                data-composer-navigation-target="reasoning">5.6 Terra 极高<svg class="icon" viewBox="0 0 16 16"><path d="m5 6 3 3 3-3"/></svg></button>
                              <button class="icon-only" data-native-slot="composer-voice" aria-label="语音输入"><svg class="icon" viewBox="0 0 16 16"><rect x="5.5" y="2.5" width="5" height="7" rx="2.5"/><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2"/></svg></button>
                              <button
                                class="send cursor-interaction size-token-button-composer flex items-center justify-center rounded-full transition-opacity focus-visible:outline-2 opacity-50"
                                type="button" data-native-slot="composer-submit"><svg class="icon" viewBox="0 0 16 16"><path d="M8 13V3M4.5 6.5 8 3l3.5 3.5"/></svg></button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  </div>
`;

export const installComposerState = (page, state = 'default') => page.evaluate(
  selectedState => {
    const root = document.querySelector('[data-codex-composer-root]');
    const abovePortal = root.querySelector('[data-above-composer-portal]');
    const stackSlot = root.querySelector('[data-native-above-stack-slot]');
    const utilitySlot = root.querySelector('[data-native-composer-utility-slot]');
    const footerActions = root.querySelector('.composer-footer-actions');
    const model = root.querySelector('[data-native-slot="composer-model"]');
    const submit = root.querySelector('[data-native-slot="composer-submit"]');

    abovePortal.replaceChildren();
    stackSlot.replaceChildren();
    utilitySlot.replaceChildren();
    utilitySlot.className = '';
    footerActions.querySelector('[data-fixture-control="goal"]')?.remove();
    model.childNodes[0].nodeValue = '5.6 Terra 极高';
    submit.removeAttribute('aria-label');
    submit.innerHTML = `
      <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 13V3M4.5 6.5 8 3l3.5 3.5"/>
      </svg>`;

    const contextButtons = `
          <button data-composer-navigation-target="workspace-project">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2 4.5h4l1.2 1.5H14v6.5H2z"/>
            </svg>
            <span>wukong-codex-theme</span>
          </button>
          <button data-composer-navigation-target="environment">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2.5" y="3" width="11" height="8" rx="1.5"/>
              <path d="M5 13h6"/>
            </svg>
            <span>本地</span>
          </button>
          <button data-composer-navigation-target="run-location">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="4" cy="3.5" r="1.5"/>
              <circle cx="4" cy="12.5" r="1.5"/>
              <circle cx="12" cy="6" r="1.5"/>
              <path d="M4 5v6M5.5 4.2C9 4.5 8 6 10.5 6"/>
            </svg>
            <b>main</b>
          </button>`;
    const contextMarkup = `
      <div class="native-composer-utility-left flex min-w-0 flex-1 flex-nowrap items-center gap-0">
        ${contextButtons}
      </div>`;
    const homeContextMarkup = `
      <div data-composer-utility-bar-scroll-area
        class="horizontal-scroll-fade-mask hide-scrollbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden native-home-composer-scroll-area"
        role="group" aria-label="Composer utility bar">
        <div class="flex w-max min-w-full items-center gap-1 native-home-composer-scroll-inner">
          ${contextButtons}
        </div>
      </div>`;

    if (selectedState === 'context') {
      utilitySlot.className =
        'native-composer-utility flex flex-wrap items-center gap-2 overflow-visible pr-2 pl-2';
      utilitySlot.innerHTML = contextMarkup;
    }
    if (selectedState === 'home-context') {
      utilitySlot.className =
        '-mx-px flex flex-nowrap items-center gap-2 overflow-hidden bg-token-side-bar-background px-2 ' +
        '-mb-4.5 rounded-t-2xl pt-2 pb-[27px] electron:relative ' +
        'electron:mx-[var(--home-composer-inline-inset)] electron:px-1.5 ' +
        'native-home-composer-utility';
      utilitySlot.innerHTML = homeContextMarkup;
    }

    if (
      selectedState === 'running' ||
      selectedState === 'guided' ||
      selectedState === 'expanded-guided' ||
      selectedState === 'multi-guided'
    ) {
      const expandedStack = selectedState === 'expanded-guided';
      const compactRowClasses = expandedStack
        ? ''
        : 'border-x border-t first:rounded-t-2xl';
      model.childNodes[0].nodeValue = '5.6 Sol 极高';
      submit.setAttribute('aria-label', '停止');
      submit.innerHTML = `
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
          <rect x="5" y="5" width="6" height="6" rx="1"
            fill="currentColor" stroke="none"/>
        </svg>`;

      const goalButton = document.createElement('button');
      goalButton.dataset.fixtureControl = 'goal';
      goalButton.innerHTML = `
        <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="5"/>
          <circle cx="8" cy="8" r="2"/>
          <path d="M8 1.5v2M14.5 8h-2"/>
        </svg>
        <span>目标</span>`;
      footerActions.append(goalButton);

      const queueCount = selectedState === 'multi-guided'
        ? 2
        : (
          selectedState === 'guided' ||
          selectedState === 'expanded-guided'
        )
          ? 1
          : 0;
      const queueItems = Array.from({ length: queueCount }, (_, index) => `
          <div class="overflow-visible native-queued-message-wrap"
            data-fixture-surface="queued-message-${index + 1}">
            <div class="group flex min-w-0 items-center justify-between gap-2 py-0.5 text-sm native-queued-message-content">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 3v6.5A2.5 2.5 0 0 0 6.5 12H12"/>
              <path d="m9.5 9.5 2.5 2.5-2.5 2.5"/>
            </svg>
            <b>${index + 1}</b>
            <span style="margin-left:auto">引导</span>
            <button aria-label="删除排队消息">
              <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 5h9M6 5V3.5h4V5M5 5l.6 8h4.8l.6-8"/>
              </svg>
            </button>
            <button aria-label="更多">
              <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="4" cy="8" r=".7" fill="currentColor" stroke="none"/>
                <circle cx="8" cy="8" r=".7" fill="currentColor" stroke="none"/>
                <circle cx="12" cy="8" r=".7" fill="currentColor" stroke="none"/>
              </svg>
            </button>
            </div>
          </div>`).join('');
      const queuePanel = queueCount > 0
        ? `
          <div class="relative min-w-0 overflow-clip text-token-foreground ${compactRowClasses} native-above-composer-row"
            data-fixture-surface="queued-panel">
            <div class="vertical-scroll-fade-mask hide-scrollbar flex max-h-[30dvh] flex-col gap-px overflow-x-hidden overflow-y-auto px-3 py-row-y native-queued-message-list">
              ${queueItems}
            </div>
          </div>`
        : '';

      abovePortal.innerHTML = `
        <div class="relative col-start-1 row-start-1 h-8 self-end native-progress-host">
          <div class="absolute inset-x-0 bottom-1 flex min-h-7 items-center justify-center gap-2 pb-1 native-progress-layer">
            <div class="pointer-events-none absolute inset-x-0 -bottom-1 h-7 bg-gradient-to-t from-token-main-surface-primary to-transparent native-progress-gradient"></div>
            <div class="flex w-full max-w-(--thread-content-max-width) min-w-0 justify-center native-progress-rail">
              <div class="relative z-10 max-w-full min-w-0 overflow-hidden rounded-3xl native-progress-clip">
                <div class="flex w-max max-w-full min-w-0 items-center gap-2 rounded-3xl border px-3 py-1.5 native-progress-pill"
                  data-state="active" data-fixture-control="plan">
                  <svg class="icon animate-spin" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="5.25" opacity=".28"/>
                    <path d="M8 2.75A5.25 5.25 0 0 1 13.25 8"/>
                  </svg>
                  <span>第 5 / 6 步 · 19 个文件已更改…</span>
                  <span style="color:#198b35">+1073</span>
                  <span style="color:#b52e27">-83</span>
                </div>
              </div>
            </div>
          </div>
        </div>`;
      stackSlot.innerHTML = `
        <div class="relative px-[var(--home-composer-inline-inset)] native-above-stack-inset ${expandedStack ? '' : 'native-collapsed'}"
          data-fixture-stack-mode="${expandedStack ? 'expanded' : 'collapsed'}">
          <div class="order-2 flex min-w-0 flex-col native-above-composer-stack"
            data-fixture-surface="composer-stack">
            ${queuePanel}
            <div class="relative min-w-0 overflow-clip text-token-foreground ${compactRowClasses} native-above-composer-row"
              data-fixture-surface="goal-panel">
            <div class="flex items-center justify-between gap-2 px-3 py-row-y native-above-composer-content">
            <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="5"/>
              <circle cx="8" cy="8" r="2"/>
              <path d="M8 1.5v2M14.5 8h-2"/>
            </svg>
            <strong>进行中的目标</strong>
            <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              需解决的问题：①解谜关卡选择页面中如果加上“当前…”
            </span>
            <span style="margin-left:auto;white-space:nowrap">4h 53m 13s</span>
            <button aria-label="编辑目标">
              <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 12.5h3l7-7-3-3-7 7v3Z"/>
              </svg>
            </button>
            <button aria-label="暂停目标">
              <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="5"/>
                <path d="M6.5 6v4M9.5 6v4"/>
              </svg>
            </button>
            <button aria-label="删除目标">
              <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3.5 5h9M6 5V3.5h4V5M5 5l.6 8h4.8l.6-8"/>
              </svg>
            </button>
            <button aria-label="展开目标">
              <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
                <path d="m6 3 5 5-5 5"/>
              </svg>
            </button>
            </div>
            </div>
          </div>
        </div>`;
    }

    return Object.fromEntries(
      [
        ['composer', '.composer-surface-chrome'],
        ['context', '[data-fixture-surface="composer-context"]'],
        ['progress', '[data-fixture-control="plan"]'],
        ['stack', '[data-fixture-surface="composer-stack"]'],
        ['queued', '[data-fixture-surface="queued-panel"]'],
        ['goal', '[data-fixture-surface="goal-panel"]'],
        ['submit', '[data-native-slot="composer-submit"]']
      ].map(([name, selector]) => {
        const element = document.querySelector(selector);
        if (!element) return [name, null];
        const rect = element.getBoundingClientRect();
        return [name, [rect.x, rect.y, rect.width, rect.height]];
      })
    );
  },
  state
);

export const geometry = page => page.evaluate(() => Object.fromEntries(
  [...document.querySelectorAll('[data-native-slot]')].map(element => {
    const rect = element.getBoundingClientRect();
    return [element.dataset.nativeSlot, [rect.x, rect.y, rect.width, rect.height]];
  })
));

export const enterThreadState = page => page.evaluate(() => {
  document.querySelector('.landing-native')?.remove();
  const conversation = document.createElement('section');
  conversation.setAttribute('data-thread-find-target', 'conversation');
  conversation.innerHTML = `
    <div class="conversation-status"><span>已处理 2m 18s</span><span>›</span></div>
    <div data-virtualized-turn-content>
      <div data-local-conversation-user-anchor><div data-user-message-bubble>请检查当前实现。</div></div>
    </div>
    <div class="flex flex-col gap-0" data-local-conversation-final-assistant="true" data-virtualized-turn-content>
      <p>我会保留原始内容、布局和组件尺寸，只进行必要的主题样式处理。</p>
      <pre><code>surface: thread\nlayout: native\nstyle: wukong</code></pre>
    </div>`;
  document.querySelector('.route-host').insertBefore(conversation, document.querySelector('.thread-summary-layer'));
  const readRect = selector => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return [rect.x, rect.y, rect.width, rect.height];
  };
  return {
    text: conversation.innerText,
    geometry: {
      userBubble: readRect('[data-user-message-bubble]'),
      assistantAnswer: readRect('[data-local-conversation-final-assistant]'),
      codeBlock: readRect('pre')
    }
  };
});

export const conversationText = page => page.evaluate(() =>
  document.querySelector('[data-thread-find-target="conversation"]')?.innerText || ''
);

export const conversationGeometry = page => page.evaluate(() => Object.fromEntries(
  [
    ['userBubble', '[data-user-message-bubble]'],
    ['assistantAnswer', '[data-local-conversation-final-assistant]'],
    ['codeBlock', 'pre']
  ].map(([key, selector]) => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return [key, [rect.x, rect.y, rect.width, rect.height]];
  })
));
