import assert from 'node:assert/strict';
import { loadNativeBundle, nodes, prop, text, key, nativeFunction, nativeObject } from './native-bundle-current-helper.mjs';

const jsxNodes = record => nodes(record.ast).filter(node => node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression');
const marked = (record, marker) => jsxNodes(record).find(node => prop(node.arguments[1], marker));
const unique = (records, predicate, label) => {
  const matches = records.filter(predicate);
  assert.equal(matches.length, 1, `Current native browser ${label} must be re-audited`);
  return matches[0];
};
const exportedAs = (bundle, record, fn) => Object.entries(bundle.exports(record)).find(([, value]) =>
  value.name === fn.ast.id?.name || value.start === fn.ast.start)?.[0];
const callToExport = (bundle, record, target, exported) => jsxNodes(record).find(node => {
  const tag = node.arguments[0];
  return tag?.type === 'MemberExpression' && bundle.imports(record)[tag.object.name]?.id === target.id && key(tag.property) === exported;
});

let cached;
export const loadBrowserSurfaceNative = () => {
  if (cached) return cached;
  const bundle = loadNativeBundle();
  // Only candidate chunks with these presentation interfaces are parsed. No
  // module factory, hook, navigation command or native transport is executed.
  const records = bundle.findModules([/data-new-tab-scroll-root|data-browser-sidebar-toolbar|data-browser-sidebar-chrome-expanded|data-app-shell-unified-tab-strip|data-app-shell-active-page|data-app-shell-workspace-layout-toggle|relative h-12 w-full border-b border-default bg-surface/]);
  const newTab = unique(records, record => !!marked(record, 'data-new-tab-scroll-root'), 'new-tab renderer');
  const toolbar = unique(records, record => !!marked(record, 'data-browser-sidebar-toolbar'), 'toolbar renderer');
  const browser = unique(records, record => !!marked(record, 'data-browser-sidebar-chrome-expanded'), 'panel renderer');
  const frameClass = 'relative h-12 w-full border-b border-default bg-surface';
  const frame = unique(records, record => jsxNodes(record).some(node => text(prop(node.arguments[1], 'className')) === frameClass), 'toolbar paint carrier');
  const workspace = unique(records, record => !!marked(record, 'data-app-shell-unified-tab-strip'), 'unified workspace');
  const activePage = unique(records, record => jsxNodes(record).some(node =>
    text(node.arguments[0]) === 'div' && text(prop(node.arguments[1], 'className')) === 'contents' && prop(node.arguments[1], 'data-app-shell-active-page')), 'active page wrapper');
  const toggle = unique(records, record => nodes(record.ast).some(node => node.type === 'ObjectExpression' &&
    text(prop(node, 'data-app-shell-workspace-layout-toggle')) === 'right-panel' && prop(node, 'aria-pressed')), 'full-view toggle');
  const toggleProps = nodes(toggle.ast).find(node => node.type === 'ObjectExpression' && text(prop(node, 'data-app-shell-workspace-layout-toggle')) === 'right-panel');
  const toggleFn = nativeFunction(toggle, toggleProps.start);
  assert.ok(exportedAs(bundle, toggle, toggleFn), 'The full-view toggle must remain an actual exported component');
  const pressed = prop(toggleProps, 'aria-pressed');
  const definitions = new Map(toggleFn.nodes.filter(node => node.type === 'VariableDeclarator' && node.id.type === 'Identifier').map(node => [node.id.name, node.init]));
  const combinedState = definitions.get(pressed.name);
  assert.equal(combinedState?.type, 'LogicalExpression');
  assert.equal(combinedState.operator, '||');
  assert.equal(combinedState.right.type, 'BinaryExpression');
  assert.equal(combinedState.right.operator, '===');
  const mode = text(combinedState.right.left) === 'full' ? combinedState.right.right : combinedState.right.left;
  assert.ok(text(combinedState.right.left) === 'full' || text(combinedState.right.right) === 'full', 'Native full-view predicate changed');
  const stateImports = [combinedState.left, mode].map(identifier => {
    const getter = definitions.get(identifier.name), member = getter?.arguments?.[0];
    assert.equal(getter?.type, 'CallExpression');
    assert.equal(member?.type, 'MemberExpression');
    const imported = bundle.imports(toggle)[member.object.name];
    assert.ok(imported && bundle.exports(bundle.module(imported.id))[key(member.property)], 'Native full-view state must come from the real exported stores');
    return imported.id;
  });
  assert.notEqual(stateImports[0], stateImports[1], 'Native full view must combine the right-panel override and workspace layout stores');
  const newTabNode = marked(newTab, 'data-new-tab-scroll-root');
  const toolbarNode = marked(toolbar, 'data-browser-sidebar-toolbar');
  const browserNode = marked(browser, 'data-browser-sidebar-chrome-expanded');
  const workspaceNode = marked(workspace, 'data-app-shell-unified-tab-strip');
  const toolbarFn = nativeFunction(toolbar, '"data-browser-sidebar-toolbar"');
  const frameFn = nativeFunction(frame, frameClass);
  const newTabFn = nativeFunction(newTab, '"data-new-tab-scroll-root"');
  const localFunctions = new Map(nodes(newTab.ast).filter(node => node.type === 'FunctionDeclaration' && node !== newTab.ast)
    .map(node => [node.id.name, node]));
  const exportedFunctions = Object.values(bundle.exports(newTab)).filter(node => node.type === 'Identifier').map(node => node.name);
  const reachable = new Set(), pending = [...exportedFunctions];
  while (pending.length) {
    const name = pending.pop();
    if (reachable.has(name) || !localFunctions.has(name)) continue;
    reachable.add(name);
    for (const call of nodes(localFunctions.get(name))) {
      if (call.type !== 'CallExpression') continue;
      // Follow local pure-renderer calls and the JSX component argument;
      // imports, hooks and native transports are inspected but never run.
      if (call.callee.type === 'Identifier') pending.push(call.callee.name);
      if (call.arguments[0]?.type === 'Identifier') pending.push(call.arguments[0].name);
    }
  }
  assert.ok(reachable.has(newTabFn.ast.id.name), 'The new-tab paint renderer must remain reachable from its real module export');
  const toolbarExport = exportedAs(bundle, toolbar, toolbarFn), frameExport = exportedAs(bundle, frame, frameFn);
  assert.ok(toolbarExport && frameExport, 'Native toolbar and paint-carrier exports changed');
  const toolbarCall = callToExport(bundle, browser, toolbar, toolbarExport);
  const frameCall = callToExport(bundle, browser, frame, frameExport);
  assert.ok(toolbarCall && frameCall, 'Native browser must import the real toolbar and separate paint carrier');
  assert.ok(prop(frameCall.arguments[1], 'children') && prop(frameCall.arguments[1], 'inert'), 'Native toolbar carrier forwarding changed');
  assert.ok(prop(browserNode.arguments[1], 'data-browser-sidebar-primary-focus-target'), 'Native browser root focus boundary changed');
  assert.equal(text(prop(browserNode.arguments[1], 'className')), 'relative h-full min-h-0 w-full min-w-0');
  assert.equal(text(prop(toolbarNode.arguments[1], 'data-browser-sidebar-toolbar')), 'true');
  assert.equal(prop(newTabNode.arguments[1], 'data-new-tab-scroll-root').operator, '!', 'Native new-tab marker must remain true');
  assert.equal(prop(newTabNode.arguments[1], 'data-new-tab-scroll-root').argument.value, 0);

  const classMember = prop(workspaceNode.arguments[1], 'className');
  assert.equal(classMember?.type, 'MemberExpression');
  const cssModule = bundle.module(bundle.imports(workspace)[classMember.object.object.name].id);
  const classes = nativeObject(cssModule, bundle.exports(cssModule)[key(classMember.object.property)]);
  for (const name of ['Workspace', 'WorkspaceContent', 'MainContentClip', 'MainContentSurface', 'MainContentViewport', 'PageSurface', 'Layout', 'PageSurfaceLayout']) {
    assert.ok(classes[name], `Native workspace class interface changed: ${name}`);
  }
  for (const marker of ['data-app-shell-page-surface', 'data-app-shell-header-placement']) {
    assert.ok(prop(workspaceNode.arguments[1], marker), `Native workspace interface changed: ${marker}`);
  }
  const mainNode = marked(workspace, 'data-app-shell-main-surface');
  const panelNode = marked(workspace, 'data-app-shell-tab-panel-controller');
  const tabsNode = marked(workspace, 'data-app-shell-tabs');
  const tabsClass = text(prop(tabsNode?.arguments[1], 'className'));
  const tabsBodyClass = nodes(workspace.ast).map(text).find(value => value === 'relative flex min-h-0 min-w-0 flex-1 bg-[var(--app-shell-panel-background,var(--color-surface))]');
  assert.ok(tabsClass && tabsBodyClass && prop(panelNode?.arguments[1], 'inert') && prop(panelNode.arguments[1], 'aria-hidden'), 'Native tab body paint and hidden-controller boundary changed');
  const tabsFn = nativeFunction(workspace, '"data-app-shell-tabs"');
  const stripCall = tabsFn.nodes.find(node => node.type === 'CallExpression' && node.arguments[0]?.type === 'MemberExpression' &&
    prop(node.arguments[1], 'controller') && prop(node.arguments[1], 'tabs') && prop(node.arguments[1], 'activeTabId'));
  assert.ok(stripCall, 'Native AppShellTabs must still use its actual shared strip renderer');
  const strip = bundle.module(bundle.imports(workspace)[stripCall.arguments[0].object.name].id);
  assert.ok(bundle.exports(strip)[key(stripCall.arguments[0].property)], 'Native strip export changed');
  const stripFn = nativeFunction(strip, '"data-app-shell-tab-row"');
  const stripId = stripFn.nodes.find(node => node.type === 'VariableDeclarator' && node.id.type === 'ObjectPattern')?.id.properties
    .find(property => key(property.key) === 'id')?.value;
  const stripBase = stripFn.nodes.map(text).find(value => value.startsWith('relative isolate flex w-full ') && value.includes('bg-transparent'));
  const stripClass = stripFn.nodes.map(text).find(value => /^strip-\S+$/.test(value));
  assert.ok(stripBase && stripClass && marked(strip, 'data-app-shell-tab-strip-controller'), 'Native row/controller strip markers changed');
  assert.equal(prop(marked(strip, 'data-app-shell-tab-strip-controller').arguments[1], 'data-app-shell-tab-strip-controller').name, stripId?.name,
    'The native strip-controller marker must forward its actual controller ID');
  const rightPanelNode = jsxNodes(workspace).find(node => key(node.arguments[0]?.property) === 'aside' &&
    text(prop(node.arguments[1], 'data-app-shell-focus-area')) === 'right-panel');
  assert.ok(rightPanelNode && prop(rightPanelNode.arguments[1], 'inert') && prop(rightPanelNode.arguments[1], 'aria-hidden'), 'Native right-panel visibility boundary changed');
  const rightPanelFn = nativeFunction(workspace, rightPanelNode.start);
  const rightPanelClass = rightPanelFn.nodes.map(text).find(value => value.startsWith('relative z-') && value.includes('h-full min-h-0 min-w-0 shrink-0 overflow-visible'));
  assert.ok(rightPanelClass, 'Native right-panel presentation class changed');
  assert.equal(key(mainNode?.arguments[0]?.property), 'main');
  assert.equal(text(prop(mainNode.arguments[1], 'data-app-shell-main-surface')), 'default');
  assert.equal(text(prop(panelNode?.arguments[1], 'role')), 'tabpanel');
  assert.ok(nodes(workspace.ast).some(node => node.type === 'Property' && key(node.key) === 'data-app-shell-workspace-layout'), 'Native full/split layout owner changed');

  const shellAssets = bundle.stylesheetAssets([`.${classes.Workspace}`, `.${classes.PageSurface}`]);
  assert.ok(shellAssets.length, 'Native shell and page paint CSS must be present');
  const shellCss = bundle.read(shellAssets[0]);
  assert.ok(shellCss.includes(`.${classes.Workspace}{display:contents}`));
  assert.ok(shellCss.includes(`.${classes.MainContentSurface}{isolation:isolate;`));
  assert.ok(shellCss.includes(`.${classes.WorkspaceContent}:before`), 'Native workspace canvas pseudo-element changed');
  const stripAssets = bundle.stylesheetAssets([`.${stripClass}`]);
  assert.ok(stripAssets.length, 'Native tab-strip component CSS changed');
  const css = [bundle.layerOrder, ...[...new Set([...bundle.baseStylesheets(), shellAssets[0], stripAssets[0]])].map(asset => bundle.read(asset))].join('\n');
  assert.ok(css.includes('.bg-surface-canvas{background-color:var(--color-surface-canvas)}'));
  assert.ok(css.includes('.bg-surface{background-color:var(--color-surface)}'));
  const newTabClass = text(prop(newTabNode.arguments[1], 'className'));
  const toolbarBaseClass = toolbarFn.nodes.map(text).find(value => value.startsWith('@container/browser-toolbar '));
  assert.ok(newTabClass.includes('bg-surface-canvas') && toolbarBaseClass && !toolbarBaseClass.includes('bg-'));
  cached = { bundle, records: { newTab, toolbar, browser, frame, workspace, activePage, toggle, strip }, classes, css, shellCss,
    newTabClass, toolbarBaseClass, frameClass, tabsClass, tabsBodyClass, rightPanelClass,
    stripClass: `${stripClass} ${stripBase} h-[var(--app-shell-header-height,var(--height-toolbar))] gap-1.5 border-b border-default`,
    browserClass: text(prop(browserNode.arguments[1], 'className')),
    toolbarExport, frameExport, toolbarCall, frameCall };
  return cached;
};

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

// Source-derived presentation fixture, not an Electron guest or a live app
// screenshot. Outer slots supply deterministic full/split geometry; native
// inner classes, semantic boundaries, paint carriers and pseudo-CSS are real.
// Business content, navigation handlers, device emulation and data are absent.
export const browserSurfaceFixture = (native, { mode = 'dark', layout = 'split' } = {}) => {
  const c = native.classes;
  const toolbar = `<div class="relative h-full min-w-0"><div id="toolbar" data-viewer-density="compact" data-browser-sidebar-toolbar="true" class="${escape(native.toolbarBaseClass)}"><button id="back" disabled aria-label="Back" class="h-7 px-2 opacity-50">Back</button><input id="address" aria-label="Address" class="h-7 min-w-0 flex-1 rounded-xl border border-default bg-surface px-3" placeholder="Address"><button id="reload" aria-label="Reload" class="h-7 px-2">Reload</button></div></div>`;
  const strip = (controller, id) => `<div id="${id}" data-app-shell-tab-row="true" role="presentation" class="${escape(native.stripClass)}"><div class="flex h-full min-w-0 flex-1 items-center"><div data-app-shell-tab-strip-controller="${controller}" role="presentation" class="flex h-full min-w-0 flex-1"><button role="tab" aria-selected="true">Fixture tab</button></div></div></div>`;
  return `<!doctype html><html data-theme="${mode}" data-codex-window-type="electron" data-codex-os="win32"><head><meta charset="utf-8"><style>${native.css}</style><style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden}#root{height:100vh}
    #layout{position:relative;width:100%;height:100%;padding:0;--height-titlebar:44px;--app-shell-titlebar-height:44px;--app-shell-navigation-rail-width:52px;--app-shell-window-radius:18px;--app-shell-left-panel-width:52px;--app-shell-application-menu-height:0px}
    #main-slot{position:absolute;inset:44px 0 0 340px;display:flex}#layout[data-fixture-layout="full"] #main-slot{left:0}
    #native-tabstrip{height:52px;flex-shrink:0;position:relative}#workspace-content{display:flex;flex:1;min-height:0}#viewport{display:flex;flex:1;min-width:0;min-height:0}#panes{display:flex;flex:1;min-height:0}
    #thread-panel{width:40%;min-width:0}#right-panel{display:flex;flex:1;min-width:0;flex-direction:column}#browser-tabs{flex:1;min-width:0}#browser-panel{position:relative;flex:1;min-width:0;min-height:0}#layout[data-fixture-layout="full"] #thread-panel{display:none}
    #full-toggle{position:absolute;right:240px;top:6px}
    #browser-slots{position:absolute;inset:0;display:flex;flex-direction:column}#browser-content{position:relative;flex:1;min-height:0;overflow:hidden}
    #native-card{width:90px;height:40px;margin:18px}#new-tab input{width:220px;max-width:100%}#new-tab button{padding:8px}
    #unrelated-canvas,#unrelated-toolbar{position:fixed;top:4px;right:4px;width:96px;height:24px;overflow:hidden}#unrelated-toolbar{right:110px}
    #guest-host{position:fixed;right:12px;bottom:12px;width:110px;height:64px;z-index:20}#guest{display:block;width:100%;height:100%;border:0}
  </style></head><body><div id="root"><div id="active-page" class="contents" data-app-shell-active-page="true"><div id="layout" class="${c.Layout} ${c.PageSurfaceLayout}" data-app-shell-page-surface="true"><div id="paint" aria-hidden="true" class="${c.PageSurface}"></div><div id="workspace" class="${c.Workspace}" data-app-shell-unified-tab-strip="true" data-app-shell-header-placement="titlebar" data-app-shell-page-surface="true"><div id="main-slot"><div class="${c.MainContentClip}"><main id="main" class="outline-none ${c.MainContentSurface}" data-app-shell-main-surface="default" tabindex="-1"><div id="native-tabstrip" data-app-shell-main-titlebar>Native tab fixture</div><div id="workspace-content" class="${c.WorkspaceContent}"><div id="viewport" class="${c.MainContentViewport}" data-app-shell-workspace-layout="${layout}"><div id="panes"><section id="thread-panel" role="tabpanel" data-app-shell-tab-panel-controller="left"><div id="native-card" class="bg-surface">Native card</div></section><section id="browser-panel" role="tabpanel" data-app-shell-tab-panel-controller="right"><div id="browser-root" class="${escape(native.browserClass)}" data-browser-sidebar-chrome-expanded="false" data-browser-sidebar-primary-focus-target="address" tabindex="-1"><div id="browser-slots"><div id="toolbar-carrier" class="${escape(native.frameClass)}">${toolbar}</div><div id="browser-content"><div id="new-tab" data-new-tab-scroll-root="true" class="${escape(native.newTabClass)}"><div class="mx-auto flex w-full max-w-3xl flex-col gap-10"><label>Native component fixture<input id="new-tab-input" aria-label="New tab query" class="rounded-xl border border-default bg-surface p-2"></label><button id="new-tab-action" class="bg-primary-soft-alpha rounded-lg">Fixture action</button><div id="nested-card" class="bg-surface">Native nested control</div></div></div></div></div></div></section></div></div></div></main></div></div></div></div></div></div><div id="unrelated-canvas" data-new-tab-scroll-root="true" class="bg-surface-canvas">Other canvas</div><div id="unrelated-toolbar" class="${escape(native.frameClass)}">${toolbar.replaceAll('id="', 'data-other-id="')}</div><div id="guest-host" data-browser-sidebar-webview><iframe id="guest" title="External guest stand-in" srcdoc="&lt;style&gt;html,body{margin:0;background:rgb(15,180,117);height:100%;color:white}&lt;/style&gt;&lt;button&gt;Guest action&lt;/button&gt;"></iframe></div><script>const panel=document.getElementById('browser-panel'),tabs=document.createElement('div'),tabsBody=document.createElement('div'),rightPane=document.createElement('aside');rightPane.id='right-panel';rightPane.dataset.appShellFocusArea='right-panel';rightPane.className=${JSON.stringify(native.rightPanelClass)};tabs.id='browser-tabs';tabs.dataset.appShellTabs='true';tabs.className=${JSON.stringify(native.tabsClass)};tabsBody.id='tabs-body';tabsBody.className=${JSON.stringify(native.tabsBodyClass)};panel.before(rightPane);rightPane.append(tabs);tabs.insertAdjacentHTML('beforeend',${JSON.stringify(strip('right','right-tabstrip'))});tabs.append(tabsBody);tabsBody.append(panel);document.getElementById('thread-panel').insertAdjacentHTML('afterbegin',${JSON.stringify(strip('left','left-tabstrip'))});document.getElementById('native-tabstrip').insertAdjacentHTML('beforeend','<button id=full-toggle data-app-shell-workspace-layout-toggle=right-panel data-app-shell-focus-area=right-panel aria-pressed=false>Full view</button>');window.fixtureClicks=0;document.getElementById('reload').onclick=()=>window.fixtureClicks++;document.getElementById('new-tab-action').onclick=()=>window.fixtureClicks++;window.fixtureLayout=value=>{document.getElementById('viewport').dataset.appShellWorkspaceLayout=value;document.getElementById('layout').dataset.fixtureLayout=value;document.getElementById('full-toggle')?.setAttribute('aria-pressed',String(value==='full'))};fixtureLayout(${JSON.stringify(layout)});</script></body></html>`;
};
