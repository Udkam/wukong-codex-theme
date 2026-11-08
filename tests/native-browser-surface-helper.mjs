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
  const rightHeader = jsxNodes(workspace).find(node => text(prop(node.arguments[1], 'data-app-shell-focus-area')) === 'right-panel' &&
    text(prop(node.arguments[1], 'data-app-shell-titlebar-slot')) === 'content');
  const leftHeader = jsxNodes(workspace).find(node => text(prop(node.arguments[1], 'data-app-shell-focus-area')) === 'main' &&
    text(prop(node.arguments[1], 'data-app-shell-titlebar-slot')) === 'main');
  assert.ok(rightHeader && leftHeader, 'Native left/right titlebar slot ownership changed');
  const rightHeaderProps = rightHeader.arguments[1], rightHeaderClass = nodes(prop(rightHeaderProps, 'className')).map(text)
    .find(value => value.startsWith('group/titlebar pointer-events-auto absolute top-0 '));
  const leftHeaderClass = nodes(prop(leftHeader.arguments[1], 'className')).map(text).find(value => value === 'pointer-events-none min-w-0');
  assert.ok(rightHeaderClass?.includes('overflow-hidden') && leftHeaderClass && prop(rightHeaderProps, 'inert') && prop(rightHeaderProps, 'aria-hidden'),
    'Native titlebar clipping/visibility boundary changed');
  const track = prop(rightHeaderProps, 'children');
  const trackClass = nodes(prop(track?.arguments?.[1], 'className')).map(text).find(value => value === 'absolute inset-y-0 flex min-w-0');
  const trackChildren = prop(track?.arguments?.[1], 'children');
  assert.equal(trackChildren?.type, 'ArrayExpression', 'Native titlebar track must retain direct sibling slots');
  const portalMount = trackChildren.elements.find(node => node?.type === 'CallExpression' &&
    key(prop(node.arguments[1], 'container')?.property) === 'content');
  const endAction = trackChildren.elements.find(node => node?.type === 'ConditionalExpression' &&
    text(prop(node.consequent?.arguments?.[1], 'className')) === 'flex shrink-0 items-center pe-2');
  assert.ok(trackClass && portalMount && endAction, 'Native tab-strip portal and complete end-action carrier must remain siblings');
  const endActionProps = endAction.consequent.arguments[1], endActionClass = text(prop(endActionProps, 'className'));
  assert.equal(key(prop(endActionProps, 'children')?.property), 'contentTitlebarEndAction');
  const mountImport = bundle.imports(workspace)[portalMount.arguments[0].object.name];
  const mountRecord = bundle.module(mountImport.id), mountFn = bundle.exports(mountRecord)[key(portalMount.arguments[0].property)];
  assert.ok(mountFn && nodes(mountFn).some(node => node.type === 'CallExpression' && key(node.callee?.property) === 'appendChild'),
    'Native titlebar portal host must still mount the actual shared content container');
  const portalHost = nodes(mountFn).find(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'div' &&
    text(prop(node.arguments[1], 'className')) === 'min-w-0 flex-1');
  assert.ok(portalHost, 'Native titlebar portal positioning carrier changed');
  const headerProviders = bundle.findModules(['contentTitlebarEndAction']).filter(record =>
    Object.values(bundle.imports(record)).some(imported => imported.id === toggle.id));
  const provider = unique(headerProviders, record => !!callToExport(bundle, record, toggle, exportedAs(bundle, toggle, toggleFn)) &&
    jsxNodes(record).some(node => key(node.arguments[0]?.property) === 'UnifiedTabStrip' && prop(node.arguments[1], 'contentTitlebarEndAction')),
  'titlebar end-action provider');
  const toggleCall = callToExport(bundle, provider, toggle, exportedAs(bundle, toggle, toggleFn));
  const actionFn = nativeFunction(provider, toggleCall.start);
  const actionGroupClass = actionFn.nodes.map(text).find(value => value === 'flex shrink-0 items-center gap-1.5');
  assert.ok(actionGroupClass && jsxNodes(provider).some(node => prop(node.arguments[1], 'contentTitlebarEndAction')),
    'The native full/split actions must still be forwarded through the titlebar end-action interface');
  // Registered HeaderAction is a distinct sibling paint layer. Its measured
  // carrier can be only 81px wide while the containing end grid spans a pane.
  const registeredAction = jsxNodes(provider).find(node => text(prop(node.arguments[1], 'actionId')) === 'unified-workspace-controls');
  assert.equal(key(registeredAction?.arguments[0]?.property), 'HeaderAction');
  assert.equal(text(prop(registeredAction.arguments[1], 'align')), 'end');
  assert.equal(text(prop(registeredAction.arguments[1], 'slotPosition')), 'right');
  assert.equal(text(prop(registeredAction.arguments[1], 'desktopPlacement')), 'titlebar');
  const registeredBody = prop(registeredAction.arguments[1], 'children');
  const registeredActionClass = text(prop(registeredBody?.arguments?.[1], 'className'));
  assert.equal(text(prop(registeredBody?.arguments?.[1], 'data-app-shell-focus-area')), 'main');
  const registrationFn = nativeFunction(provider, registeredAction.start);
  assert.ok(registrationFn.nodes.some(node => node.type === 'CallExpression' && node.arguments[0]?.name === actionFn.ast.id.name),
    'The registered main-focus HeaderAction must still contain the actual full/split action provider');
  const endSlotNode = marked(workspace, 'data-app-shell-header-slot'), slotFn = nativeFunction(workspace, endSlotNode.start);
  const slotBaseClass = slotFn.nodes.map(text).find(value => value === 'pointer-events-none relative grid [-webkit-app-region:initial]');
  const measured = slotFn.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'className')) ===
    'pointer-events-none col-start-1 row-start-1 h-full w-max justify-self-end');
  assert.ok(slotBaseClass && measured && prop(endSlotNode.arguments[1], 'data-app-shell-header-obstacle'), 'Native live measured end-slot carrier changed');
  assert.ok(slotFn.nodes.some(node => text(node) === 'pe-2') && slotFn.nodes.some(node => text(node) === 'h-full'), 'Native full-height end padding changed');
  const slotContent = marked(workspace, 'data-app-shell-header-slot-content'), slotContentFn = nativeFunction(workspace, slotContent.start);
  const slotContentBaseClass = slotContentFn.nodes.map(text).find(value => value === 'inline-flex h-full items-center gap-toolbar-action');
  const slotContentLiveClass = slotContentFn.nodes.map(text).find(value => value === 'no-drag pointer-events-auto w-auto');
  const registeredEntryFn = nativeFunction(workspace, 'no-drag pointer-events-auto flex shrink-0 items-center');
  assert.ok(slotContentBaseClass && slotContentLiveClass && registeredEntryFn.nodes.some(node => text(node) === 'ms-auto'), 'Native live end-slot entry composition changed');
  const clipLayer = jsxNodes(workspace).find(node => text(prop(node.arguments[1], 'className')) === 'pointer-events-none absolute inset-0 [-webkit-app-region:initial]' &&
    prop(prop(node.arguments[1], 'style'), 'clipPath') && prop(node.arguments[1], 'children') === rightHeader);
  assert.ok(clipLayer, 'Native content titlebar must retain its separate clipping layer');
  const headerNode = marked(workspace, 'data-app-shell-titlebar'), headerFn = nativeFunction(workspace, headerNode.start);
  const endCall = headerFn.nodes.find(node => node.type === 'CallExpression' && node.arguments[0]?.name === slotFn.ast.id.name &&
    text(prop(node.arguments[1], 'side')) === 'end' && !prop(node.arguments[1], 'inTitlebar'));
  // Native React memoization assigns the clipped layer through its real
  // titlebar-slot null guard: Y = slots == null ? null : <clipped layer>.
  // Bind that exact guarded JSX branch instead of expecting a direct RHS.
  const clipAssignment = headerFn.nodes.find(node => node.type === 'AssignmentExpression' &&
    node.left.type === 'Identifier' && node.right?.type === 'ConditionalExpression' &&
    node.right.alternate === clipLayer && node.right.consequent.type === 'Literal' && node.right.consequent.value === null);
  const clipGuard = clipAssignment?.right.test;
  assert.ok(clipGuard?.type === 'BinaryExpression' && clipGuard.operator === '==' &&
    [clipGuard.left, clipGuard.right].some(node => node.type === 'Literal' && node.value === null),
  'The native content clipping layer must retain its titlebar-slot null guard');
  const clipBinding = clipAssignment?.left.name;
  const endBinding = headerFn.nodes.find(node => node.type === 'AssignmentExpression' && node.right === endCall)?.left.name;
  const headerChildren = prop(headerNode.arguments[1], 'children')?.elements.map(node => node?.name);
  assert.ok(clipBinding && endBinding && headerChildren?.indexOf(clipBinding) >= 0 &&
    headerChildren.indexOf(endBinding) > headerChildren.indexOf(clipBinding),
  'Registered end slots paint after the clipped content layer; painting the entire grid would cover native tabs');
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
    rightHeaderClass, leftHeaderClass, trackClass, endActionClass, actionGroupClass,
    registeredActionClass, endSlotClass: `${slotBaseClass} min-w-max ms-auto h-full shrink`,
    endMeasuredClass: text(prop(measured.arguments[1], 'className')), endPaddingClass: 'h-full pe-2',
    endContentClass: `${slotContentBaseClass} ${slotContentLiveClass}`,
    registeredEntryClass: 'no-drag pointer-events-auto flex shrink-0 items-center ms-auto',
    clipLayerClass: text(prop(clipLayer.arguments[1], 'className')),
    portalHostClass: text(prop(portalHost.arguments[1], 'className')),
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
export const browserSurfaceFixture = (native, { mode = 'dark', layout = 'split', registeredEndSlot = false } = {}) => {
  const c = native.classes;
  const toolbar = `<div class="relative h-full min-w-0"><div id="toolbar" data-viewer-density="compact" data-browser-sidebar-toolbar="true" class="${escape(native.toolbarBaseClass)}"><button id="back" disabled aria-label="Back" class="h-7 px-2 opacity-50">Back</button><input id="address" aria-label="Address" class="h-7 min-w-0 flex-1 rounded-xl border border-default bg-surface px-3" placeholder="Address"><button id="reload" aria-label="Reload" class="h-7 px-2">Reload</button></div></div>`;
  const strip = (controller, id) => `<div id="${id}" data-app-shell-tab-row="true" role="presentation" class="${escape(native.stripClass)}"><div class="flex h-full min-w-0 flex-1 items-center"><div data-app-shell-tab-strip-controller="${controller}" role="presentation" class="flex h-full min-w-0 flex-1"><button role="tab" aria-selected="true">Fixture tab</button></div></div></div>`;
  const rightHeader = `<div id="right-header-slot" class="${escape(native.rightHeaderClass)}" data-app-shell-focus-area="right-panel" data-app-shell-titlebar-slot="content"><div id="right-header-track" class="${escape(native.trackClass)} left-0"><div id="right-header-portal" class="${escape(native.portalHostClass)}"><div id="shared-titlebar-content" class="contents" data-app-shell-titlebar-content="true">${strip('right', 'right-tabstrip')}</div></div><div id="right-header-actions" class="${escape(native.endActionClass)}"><div class="${escape(native.actionGroupClass)}"><button id="full-toggle" class="h-7 px-1" data-app-shell-workspace-layout-toggle="right-panel" data-app-shell-focus-area="right-panel" aria-pressed="false" aria-label="Full view">Full</button><button id="split-toggle" class="h-7 px-1" data-app-shell-workspace-layout-toggle="main" aria-pressed="true" aria-label="Split view">Split</button></div></div></div></div>`;
  const leftHeader = `<div id="left-header-slot" class="${escape(native.leftHeaderClass)}" data-app-shell-focus-area="main" data-app-shell-titlebar-slot="main"><div class="min-w-0 flex-1">${strip('left', 'left-tabstrip')}</div><button id="left-header-action" class="pointer-events-auto h-7 px-1" aria-label="Left chat action">Chat</button></div>`;
  const registeredEnd = `<div id="registered-end-slot" data-app-shell-header-slot="end" data-app-shell-header-obstacle="true" class="${escape(native.endSlotClass)}"><div id="registered-end-measure" class="${escape(native.endMeasuredClass)}"><div id="registered-end-padding" class="${escape(native.endPaddingClass)}"><div id="registered-slot-content" data-app-shell-header-slot-content="true" class="${escape(native.endContentClass)}"><div id="registered-entry" class="${escape(native.registeredEntryClass)}"><div id="registered-action-root" data-app-shell-focus-area="main" class="${escape(native.registeredActionClass)}"><span aria-hidden="true" class="shrink-0" style="width:1px"></span></div></div></div></div></div></div>`;
  return `<!doctype html><html data-theme="${mode}" data-codex-window-type="electron" data-codex-os="win32"><head><meta charset="utf-8"><style>${native.css}</style><style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden}#root{height:100vh}
    #layout{position:relative;width:100%;height:100%;padding:0;--height-titlebar:44px;--app-shell-titlebar-height:44px;--app-shell-navigation-rail-width:52px;--app-shell-window-radius:18px;--app-shell-left-panel-width:52px;--app-shell-application-menu-height:0px}
    #main-slot{position:absolute;inset:44px 0 0 340px;display:flex}#layout[data-fixture-layout="full"] #main-slot{left:0}
    #native-tabstrip{height:52px;flex-shrink:0;position:relative}#workspace-content{display:flex;flex:1;min-height:0}#viewport{display:flex;flex:1;min-width:0;min-height:0}#panes{display:flex;flex:1;min-height:0}
    #thread-panel{width:40%;min-width:0}#right-panel{display:flex;flex:1;min-width:0;flex-direction:column}#browser-tabs{flex:1;min-width:0}#browser-panel{position:relative;flex:1;min-width:0;min-height:0}#layout[data-fixture-layout="full"] #thread-panel{display:none}
    #right-header-slot{right:0;top:0;width:60%;height:100%}#right-header-track{width:100%}
    #left-header-slot{position:absolute;left:0;top:0;width:40%;height:100%;display:flex}
    #layout[data-fixture-layout="full"] #right-header-slot{width:100%}#layout[data-fixture-layout="full"] #left-header-slot{display:none}
    /* A deterministic outer-layout gap exercises the complete native owner;
       this spacing is fixture input, never a production geometry override. */
    #right-header-portal{margin-inline-end:90px}#right-header-slot button,#left-header-slot button{white-space:nowrap}
    /* This second native branch models the measured 81x52px live end carrier.
       Its containing grid remains pane-wide and paints after the clipped row. */
    #native-tabstrip[data-registered-end-slot="true"] #right-header-portal{margin-inline-end:0}
    #registered-end-slot{position:absolute;right:0;top:0;width:60%;height:100%}
    #layout[data-fixture-layout="full"] #registered-end-slot{width:100%}
    #registered-slot-content{width:73px}#registered-action-root{width:69px}#registered-action-group{width:62px}
    #registered-action-group>button{width:28px;height:28px;padding:0}
    #browser-slots{position:absolute;inset:0;display:flex;flex-direction:column}#browser-content{position:relative;flex:1;min-height:0;overflow:hidden}
    #native-card{width:90px;height:40px;margin:18px}#new-tab input{width:220px;max-width:100%}#new-tab button{padding:8px}
    #unrelated-canvas,#unrelated-toolbar{position:fixed;top:4px;right:4px;width:96px;height:24px;overflow:hidden}#unrelated-toolbar{right:110px}
    #guest-host{position:fixed;right:12px;bottom:12px;width:110px;height:64px;z-index:20}#guest{display:block;width:100%;height:100%;border:0}
  </style></head><body><div id="root"><div id="active-page" class="contents" data-app-shell-active-page="true"><div id="layout" class="${c.Layout} ${c.PageSurfaceLayout}" data-app-shell-page-surface="true"><div id="paint" aria-hidden="true" class="${c.PageSurface}"></div><div id="workspace" class="${c.Workspace}" data-app-shell-unified-tab-strip="true" data-app-shell-header-placement="titlebar" data-app-shell-page-surface="true"><div id="main-slot"><div class="${c.MainContentClip}"><main id="main" class="outline-none ${c.MainContentSurface}" data-app-shell-main-surface="default" tabindex="-1"><div id="native-tabstrip" data-app-shell-main-titlebar>Native tab fixture</div><div id="workspace-content" class="${c.WorkspaceContent}"><div id="viewport" class="${c.MainContentViewport}" data-app-shell-workspace-layout="${layout}"><div id="panes"><section id="thread-panel" role="tabpanel" data-app-shell-tab-panel-controller="left"><div id="native-card" class="bg-surface">Native card</div></section><section id="browser-panel" role="tabpanel" data-app-shell-tab-panel-controller="right"><div id="browser-root" class="${escape(native.browserClass)}" data-browser-sidebar-chrome-expanded="false" data-browser-sidebar-primary-focus-target="address" tabindex="-1"><div id="browser-slots"><div id="toolbar-carrier" class="${escape(native.frameClass)}">${toolbar}</div><div id="browser-content"><div id="new-tab" data-new-tab-scroll-root="true" class="${escape(native.newTabClass)}"><div class="mx-auto flex w-full max-w-3xl flex-col gap-10"><label>Native component fixture<input id="new-tab-input" aria-label="New tab query" class="rounded-xl border border-default bg-surface p-2"></label><button id="new-tab-action" class="bg-primary-soft-alpha rounded-lg">Fixture action</button><div id="nested-card" class="bg-surface">Native nested control</div></div></div></div></div></div></section></div></div></div></main></div></div></div></div></div></div><div id="unrelated-canvas" data-new-tab-scroll-root="true" class="bg-surface-canvas">Other canvas</div><div id="unrelated-toolbar" class="${escape(native.frameClass)}">${toolbar.replaceAll('id="', 'data-other-id="')}</div><div id="guest-host" data-browser-sidebar-webview><iframe id="guest" title="External guest stand-in" srcdoc="&lt;style&gt;html,body{margin:0;background:rgb(15,180,117);height:100%;color:white}&lt;/style&gt;&lt;button&gt;Guest action&lt;/button&gt;"></iframe></div><script>const panel=document.getElementById('browser-panel'),tabs=document.createElement('div'),tabsBody=document.createElement('div'),rightPane=document.createElement('aside');rightPane.id='right-panel';rightPane.dataset.appShellFocusArea='right-panel';rightPane.className=${JSON.stringify(native.rightPanelClass)};tabs.id='browser-tabs';tabs.dataset.appShellTabs='true';tabs.className=${JSON.stringify(native.tabsClass)};tabsBody.id='tabs-body';tabsBody.className=${JSON.stringify(native.tabsBodyClass)};panel.before(rightPane);rightPane.append(tabs);tabs.append(tabsBody);tabsBody.append(panel);document.getElementById('native-tabstrip').insertAdjacentHTML('beforeend',${JSON.stringify(leftHeader+rightHeader)});if(${JSON.stringify(registeredEndSlot)}){const header=document.getElementById('native-tabstrip');header.dataset.registeredEndSlot='true';header.dataset.appShellTitlebar='true';const clip=document.createElement('div');clip.id='right-header-clip';clip.className=${JSON.stringify(native.clipLayerClass)};clip.style.clipPath='inset(0px 81px 0px 6px)';clip.append(document.getElementById('right-header-slot'));header.append(clip);header.insertAdjacentHTML('beforeend',${JSON.stringify(registeredEnd)});const group=document.querySelector('#right-header-actions>div');group.id='registered-action-group';document.getElementById('registered-action-root').append(group);document.getElementById('right-header-actions').remove();document.getElementById('full-toggle').textContent='F';document.getElementById('split-toggle').textContent='S'}window.fixtureClicks=0;window.leftClicks=0;document.getElementById('full-toggle').onclick=()=>{fixtureClicks++;fixtureLayout('full')};document.getElementById('split-toggle').onclick=()=>{fixtureClicks++;fixtureLayout('split')};document.getElementById('left-header-action').onclick=()=>leftClicks++;document.getElementById('reload').onclick=()=>window.fixtureClicks++;document.getElementById('new-tab-action').onclick=()=>window.fixtureClicks++;window.fixtureLayout=value=>{document.getElementById('viewport').dataset.appShellWorkspaceLayout=value;document.getElementById('layout').dataset.fixtureLayout=value;document.getElementById('full-toggle')?.setAttribute('aria-pressed',String(value==='full'));document.getElementById('split-toggle')?.setAttribute('aria-pressed',String(value==='split'))};fixtureLayout(${JSON.stringify(layout)});</script></body></html>`;
};
