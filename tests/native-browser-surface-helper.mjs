import assert from 'node:assert/strict';
import { loadNativeBundle, nodes, ownNodes, prop, text, key, nativeFunction, presentationHarness } from './native-bundle-current-helper.mjs';
import { loadNativeShell, shellHtml } from './native-shell-current-helper.mjs';

const jsxNodes = record => nodes(record.ast).filter(node => node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression');
const marked = (record, marker) => jsxNodes(record).find(node => prop(node.arguments[1], marker));
const unique = (records, predicate, label) => {
  const matches = records.filter(predicate);
  assert.equal(matches.length, 1, `Current native browser ${label} must be re-audited`);
  return matches[0];
};
const exportedAs = (bundle, record, fn) => Object.entries(bundle.exports(record)).find(([, value]) =>
  value === fn.ast || fn.ast.id?.name && value.name === fn.ast.id.name)?.[0];
const callToExport = (bundle, record, target, exported) => jsxNodes(record).find(node => {
  const tag = node.arguments[0];
  return tag?.type === 'MemberExpression' && bundle.imports(record)[tag.object.name]?.id === target.id && key(tag.property) === exported;
});
const classValue = (node, bindings) => {
  if (node.type === 'Literal') return node.value;
  if (node.type === 'Identifier') { assert.ok(Object.hasOwn(bindings, node.name)); return bindings[node.name]; }
  if (node.type === 'UnaryExpression' && node.operator === '!') return !classValue(node.argument, bindings);
  if (node.type === 'ArrayExpression') return node.elements.map(value => classValue(value, bindings));
  if (node.type === 'LogicalExpression' && node.operator === '&&') return classValue(node.left, bindings) && classValue(node.right, bindings);
  if (node.type === 'ConditionalExpression') return classValue(node.test, bindings) ? classValue(node.consequent, bindings) : classValue(node.alternate, bindings);
  assert.fail(`Native browser shell class expression changed: ${node.type}`);
};
const cssLiteral = (bundle, record, node) => {
  if (node.type === 'Literal') return node.value;
  if (node.type === 'Identifier') {
    const declaration = ownNodes(record.ast).find(value => value.type === 'VariableDeclarator' && value.id.name === node.name);
    assert.ok(declaration, 'Native launcher CSS constant must retain a local declaration');
    return cssLiteral(bundle, record, declaration.init);
  }
  if (node.type === 'MemberExpression') {
    const imported = bundle.imports(record)[node.object.name], target = imported && bundle.module(imported.id);
    assert.ok(target, 'Native launcher inset must come from an actual imported constant');
    return cssLiteral(bundle, target, bundle.exports(target)[key(node.property)]);
  }
  assert.equal(node.type, 'TemplateLiteral', 'Native launcher CSS must remain literal presentation syntax');
  return node.quasis.map((part, index) => part.value.cooked + (node.expressions[index] ? cssLiteral(bundle, record, node.expressions[index]) : '')).join('');
};

let cached;
export const loadBrowserSurfaceNative = () => {
  if (cached) return cached;
  const bundle = loadNativeBundle();
  // Candidate chunks are inspected as source. Only the empty divider's pure
  // presentation renderer executes, with its two state readers held inert.
  const frameClass = 'relative flex min-h-12 w-full flex-col gap-2 border-b border-default bg-surface py-2';
  const records = bundle.findModules([/data-new-tab-scroll-root|data-browser-sidebar-toolbar|data-browser-sidebar-chrome-expanded|data-app-shell-unified-tab-strip|data-app-shell-active-page|data-app-shell-workspace-layout-toggle|relative flex min-h-12 w-full flex-col gap-2 border-b border-default bg-surface py-2/]);
  const newTab = unique(records, record => !!marked(record, 'data-new-tab-scroll-root'), 'new-tab renderer');
  const toolbar = unique(records, record => !!marked(record, 'data-browser-sidebar-toolbar'), 'toolbar renderer');
  const browser = unique(records, record => !!marked(record, 'data-browser-sidebar-chrome-expanded'), 'panel renderer');
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
  const newTabInner = prop(newTabNode.arguments[1], 'children');
  const newTabInnerClass = text(prop(newTabInner?.arguments?.[1], 'className'));
  assert.equal(newTabInnerClass, 'mx-auto flex w-full max-w-xl flex-col gap-8');
  const resolveStyle = call => {
    const binding = prop(call.arguments[1], 'style');
    const assignment = newTabFn.nodes.find(node => node.type === 'AssignmentExpression' && node.left.name === binding?.name && node.right.type === 'ObjectExpression');
    assert.ok(assignment, 'Native launcher scroll and content insets retain their own literal style objects');
    return Object.fromEntries(assignment.right.properties.map(property => [key(property.key), cssLiteral(bundle, newTab, property.value)]));
  };
  const newTabStyle = resolveStyle(newTabNode), newTabInnerStyle = resolveStyle(newTabInner);
  assert.deepEqual(Object.keys(newTabStyle).sort(), ['paddingBottom', 'scrollPaddingBottom', 'scrollPaddingTop']);
  assert.deepEqual(newTabInnerStyle, { paddingTop: `max(25cqh, ${newTabStyle.scrollPaddingTop})` });
  assert.equal(newTabStyle.paddingBottom, `max(calc(var(--spacing) * 8), ${newTabStyle.scrollPaddingBottom})`);
  const launcherRegistry = unique(bundle.findModules(['AddressInput', 'Page']), record => nodes(record.ast).some(node =>
    node.type === 'ObjectExpression' && prop(node, 'AddressInput') && prop(node, 'Page')), 'launcher page registry');
  const launcherEntryCall = callToExport(bundle, launcherRegistry, newTab, Object.keys(bundle.exports(newTab))[0]);
  assert.equal(text(prop(launcherEntryCall?.arguments?.[1], 'surface')), 'new-tab');
  assert.ok(prop(launcherEntryCall.arguments[1], 'search') && prop(launcherEntryCall.arguments[1], 'target'), 'Actual launcher Page forwards its search and panel target');
  const localFunctions = new Map(nodes(newTab.ast).filter(node => node.type === 'FunctionDeclaration' && node !== newTab.ast)
    .map(node => [node.id.name, node]));
  const exportedFunctions = Object.values(bundle.exports(newTab)).filter(node => node.type === 'Identifier').map(node => node.name);
  const entryFunction = localFunctions.get(exportedFunctions[0]);
  const newTabRender = nodes(entryFunction).find(node => node.type === 'CallExpression' && node.arguments[0]?.name === newTabFn.ast.id.name);
  const newTabBranch = nodes(entryFunction).find(node => node.type === 'ConditionalExpression' && node.consequent === newTabRender);
  assert.ok(newTabRender && prop(newTabRender.arguments[1], 'search'), 'The exported launcher forwards search to the real new-tab layout');
  assert.equal(newTabBranch?.test.type, 'BinaryExpression');
  assert.equal(newTabBranch.test.operator, '===');
  assert.ok([newTabBranch.test.left, newTabBranch.test.right].some(node => text(node) === 'new-tab'), 'The new-tab surface selects its real scrolling launcher branch');
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
  const navigationSlot = nodes(browser.ast).find(node => text(prop(node, 'id')) === 'browser-navigation');
  assert.equal(prop(navigationSlot, 'content'), frameCall, 'The browser navigation slot must use the native paint carrier');
  assert.equal(text(prop(navigationSlot, 'height')), 'content', 'Native toolbar height must follow its content');
  const navigationBranch = nodes(browser.ast).find(node => node.type === 'ConditionalExpression' &&
    node.consequent?.type === 'ArrayExpression' && node.consequent.elements.length === 0 &&
    node.alternate?.type === 'ArrayExpression' && node.alternate.elements.includes(navigationSlot));
  const browserSlots = nodes(browser.ast).find(node => node !== browser.ast && node.type === 'FunctionDeclaration' && nodes(node).includes(navigationSlot));
  const slotParameters = nodes(browserSlots).find(node => node.type === 'ObjectPattern' &&
    ['newTabSearch', 'toolbar'].every(name => node.properties.some(property => key(property.key) === name)));
  const searchParameter = slotParameters?.properties.find(property => key(property.key) === 'newTabSearch')?.value;
  const toolbarParameter = slotParameters?.properties.find(property => key(property.key) === 'toolbar')?.value;
  assert.equal(searchParameter?.type, 'Identifier'); assert.equal(toolbarParameter?.type, 'Identifier');
  assert.equal(navigationBranch?.test.type, 'LogicalExpression');
  assert.equal(navigationBranch.test.operator, '||');
  for (const [condition, parameter, operator] of [[navigationBranch.test.left, searchParameter, '!='], [navigationBranch.test.right, toolbarParameter, '==']]) {
    assert.equal(condition.type, 'BinaryExpression'); assert.equal(condition.operator, operator);
    assert.ok([condition.left, condition.right].some(value => value.type === 'Literal' && value.value === null));
    assert.ok([condition.left, condition.right].some(value => value.name === parameter?.name), 'Launcher search or absent toolbar omits the native navigation header row');
  }
  const slotCall = nodes(browserSlots).find(node => node.type === 'CallExpression' && prop(node.arguments[0], 'headerRows') && nodes(prop(node.arguments[0], 'headerRows')).includes(navigationSlot));
  const launcherPageCall = nodes(prop(slotCall?.arguments?.[0], 'content')).find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'search')?.name === searchParameter.name);
  assert.ok(launcherPageCall && prop(launcherPageCall.arguments[1], 'browserTabId'), 'The actual launcher Page sits in the native content viewport');
  assert.ok(prop(frameCall.arguments[1], 'children') && prop(frameCall.arguments[1], 'inert'), 'Native toolbar carrier forwarding changed');
  assert.ok(prop(browserNode.arguments[1], 'data-browser-sidebar-primary-focus-target'), 'Native browser root focus boundary changed');
  assert.equal(text(prop(browserNode.arguments[1], 'className')), 'relative h-full min-h-0 w-full min-w-0');
  assert.equal(text(prop(toolbarNode.arguments[1], 'data-browser-sidebar-toolbar')), 'true');
  assert.equal(prop(newTabNode.arguments[1], 'data-new-tab-scroll-root').operator, '!', 'Native new-tab marker must remain true');
  assert.equal(prop(newTabNode.arguments[1], 'data-new-tab-scroll-root').argument.value, 0);

  const shell = loadNativeShell({ bundle });
  assert.equal(shell.workspace.record, workspace, 'The browser and shell must share the real main-content renderer');
  assert.equal(bundle.stylesheetAssets('PageSurface-').length, 0, 'A restored native PageSurface requires a fresh ownership audit');
  for (const marker of ['data-app-shell-page-surface', 'data-app-shell-compact-page-gutter']) {
    assert.ok(prop(workspaceNode.arguments[1], marker), `Native workspace interface changed: ${marker}`);
  }
  const mainNode = marked(workspace, 'data-app-shell-main-surface');
  const mainClassCall = shell.workspace.owner.nodes.find(node => node.type === 'AssignmentExpression' &&
    node.left.name === prop(mainNode.arguments[1], 'className')?.name && node.right.type === 'CallExpression')?.right;
  assert.ok(mainClassCall, 'Native painted main class expression changed');
  const mainClassBindings = Object.fromEntries(mainClassCall.arguments.flatMap(nodes).filter(node => node.type === 'Identifier').map(node => [node.name, false]));
  const hasPageSurfaceParameter = shell.workspace.owner.nodes.find(node => node.type === 'Property' && key(node.key) === 'hasPageSurface' && node.value.type === 'Identifier')?.value.name;
  const unifiedTabsParameter = prop(workspaceNode.arguments[1], 'data-app-shell-unified-tab-strip')?.name;
  assert.ok(hasPageSurfaceParameter && unifiedTabsParameter, 'Native unified shell state bindings changed');
  mainClassBindings[hasPageSurfaceParameter] = true;
  mainClassBindings[unifiedTabsParameter] = true;
  const mainClass = mainClassCall.arguments.map(node => classValue(node, mainClassBindings)).flat(Infinity).filter(value => typeof value === 'string' && value).join(' ');
  const tabsRecord = unique(bundle.findModules(['"data-app-shell-tabs"']), record => !!marked(record, 'data-app-shell-tabs'), 'tab panel transport');
  const panelNode = marked(tabsRecord, 'data-app-shell-tab-panel-controller');
  const tabsNode = marked(tabsRecord, 'data-app-shell-tabs');
  const tabsClass = text(prop(tabsNode?.arguments[1], 'className'));
  const tabsBodyClass = nodes(tabsRecord.ast).map(text).find(value => value === 'relative flex min-h-0 min-w-0 flex-1 bg-[var(--app-shell-panel-background,var(--color-surface))]');
  assert.ok(tabsClass && tabsBodyClass && prop(panelNode?.arguments[1], 'inert') && prop(panelNode.arguments[1], 'aria-hidden'), 'Native tab body paint and hidden-controller boundary changed');
  const tabsFn = nativeFunction(tabsRecord, '"data-app-shell-tabs"');
  const stripCall = tabsFn.nodes.find(node => node.type === 'CallExpression' && node.arguments[0]?.type === 'MemberExpression' &&
    prop(node.arguments[1], 'controller') && prop(node.arguments[1], 'tabs') && prop(node.arguments[1], 'activeTabId'));
  assert.ok(stripCall, 'Native AppShellTabs must still use its actual shared strip renderer');
  const strip = bundle.module(bundle.imports(tabsRecord)[stripCall.arguments[0].object.name].id);
  assert.ok(bundle.exports(strip)[key(stripCall.arguments[0].property)], 'Native strip export changed');
  const stripFn = nativeFunction(strip, '"data-app-shell-tab-row"');
  const stripId = stripFn.nodes.find(node => node.type === 'VariableDeclarator' && node.id.type === 'ObjectPattern')?.id.properties
    .find(property => key(property.key) === 'id')?.value;
  const stripBase = stripFn.nodes.map(text).find(value => value.startsWith('relative isolate flex w-full ') && value.includes('bg-transparent'));
  assert.ok(stripBase && marked(strip, 'data-app-shell-tab-strip-controller'), 'Native row/controller strip markers changed');
  assert.equal(prop(marked(strip, 'data-app-shell-tab-strip-controller').arguments[1], 'data-app-shell-tab-strip-controller').name, stripId?.name,
    'The native strip-controller marker must forward its actual controller ID');
  const rightPanelNode = jsxNodes(workspace).find(node => key(node.arguments[0]?.property) === 'aside' &&
    text(prop(node.arguments[1], 'data-app-shell-focus-area')) === 'right-panel');
  assert.ok(rightPanelNode && prop(rightPanelNode.arguments[1], 'inert') && prop(rightPanelNode.arguments[1], 'aria-hidden'), 'Native right-panel visibility boundary changed');
  const rightPanelFn = nativeFunction(workspace, rightPanelNode.start);
  const rightPanelClass = rightPanelFn.nodes.map(text).find(value => value.startsWith('relative z-') && value.includes('h-full min-h-0 shrink-0 overflow-visible'));
  assert.ok(rightPanelClass, 'Native right-panel presentation class changed');
  const paneSurfaceCall = rightPanelFn.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'showBorder') && prop(node.arguments[1], 'resizer'));
  const paneSurfaceRecord = bundle.module(bundle.imports(workspace)[paneSurfaceCall.arguments[0].object.name].id);
  const paneSurfaceExport = bundle.exports(paneSurfaceRecord)[key(paneSurfaceCall.arguments[0].property)];
  const paneSurfaceFn = nativeFunction(paneSurfaceRecord, paneSurfaceExport.start);
  const paneSurfaceClass = paneSurfaceFn.nodes.map(text).find(value => value === 'absolute top-0 bottom-0');
  const paneSurfaceClipClass = paneSurfaceFn.nodes.map(text).find(value => value === 'absolute inset-0 min-h-0 min-w-0 overflow-hidden');
  const paneContentClass = rightPanelFn.nodes.map(text).find(value => value.startsWith('flex h-full min-h-0 min-w-0 flex-col overflow-hidden overscroll-y-contain'));
  assert.ok(paneSurfaceClass && paneSurfaceClipClass && paneContentClass);
  assert.ok(['border-default', 'border-l', 'border-r'].every(value => paneSurfaceFn.nodes.some(node => text(node) === value)), 'The native body border keeps its independent pane carrier and physical edge variants');
  const rightHeader = jsxNodes(workspace).find(node => text(prop(node.arguments[1], 'data-app-shell-focus-area')) === 'right-panel' &&
    nodes(prop(node.arguments[1], 'className')).some(value => text(value).startsWith('absolute top-0 flex h-full min-w-0 overflow-x-clip')));
  const leftHeader = jsxNodes(workspace).find(node => text(prop(node.arguments[1], 'data-app-shell-focus-area')) === 'main' &&
    nodes(prop(node.arguments[1], 'className')).some(value => text(value) === 'pointer-events-none min-w-0'));
  assert.ok(rightHeader && leftHeader, 'Native left/right titlebar slot ownership changed');
  const rightHeaderProps = rightHeader.arguments[1], rightHeaderClass = nodes(prop(rightHeaderProps, 'className')).map(text)
    .find(value => value.startsWith('absolute top-0 flex h-full min-w-0 overflow-x-clip'));
  const leftHeaderClass = nodes(prop(leftHeader.arguments[1], 'className')).map(text).find(value => value === 'pointer-events-none min-w-0');
  assert.ok(rightHeaderClass?.includes('overflow-x-clip') && leftHeaderClass && prop(rightHeaderProps, 'inert') && prop(rightHeaderProps, 'aria-hidden'),
    'Native titlebar clipping/visibility boundary changed');
  const track = prop(rightHeaderProps, 'children');
  const trackClass = nodes(prop(track?.arguments?.[1], 'className')).map(text).find(value => value === 'absolute inset-y-0 flex min-w-0');
  const trackChildren = prop(track?.arguments?.[1], 'children');
  assert.equal(trackChildren?.type, 'ArrayExpression', 'Native titlebar track must retain direct sibling slots');
  const dividerCall = trackChildren.elements.find(node => node?.type === 'CallExpression' && text(prop(node.arguments[1], 'region')) === 'content' && prop(node.arguments[1], 'boundary'));
  assert.ok(dividerCall, 'The native content divider remains a sibling of the tab portal and end controls');
  const dividerRecord = bundle.module(bundle.imports(workspace)[dividerCall.arguments[0].object.name].id);
  const dividerExport = bundle.exports(dividerRecord)[key(dividerCall.arguments[0].property)];
  const dividerFn = nativeFunction(dividerRecord, dividerExport.start);
  const dividerNode = marked(dividerRecord, 'data-app-shell-titlebar-divider');
  const dividerClass = dividerFn.nodes.map(text).find(value => value === 'pointer-events-none absolute z-10 w-px bg-border');
  assert.ok(dividerClass && dividerNode && prop(dividerNode.arguments[1], 'aria-hidden'));
  assert.equal(prop(dividerNode.arguments[1], 'children'), undefined, 'The titlebar divider is an empty decoration, separate from the resize hit area');
  const dividerParameters = dividerFn.nodes.find(node => node.type === 'ObjectPattern' && node.properties.some(property => key(property.key) === 'boundary'));
  assert.equal(prop(dividerNode.arguments[1], 'data-app-shell-titlebar-divider')?.name,
    dividerParameters?.properties.find(property => key(property.key) === 'boundary')?.value.name);
  assert.ok(nodes(prop(dividerCall.arguments[1], 'className')).some(node => text(node) === 'inset-y-0') &&
    nodes(prop(dividerCall.arguments[1], 'className')).some(node => text(node) === 'start-0'), 'The native me-1 pane divider uses its full-height start branch');
  const dividerCaller = nativeFunction(workspace, dividerCall.start), boundaryBinding = prop(dividerCall.arguments[1], 'boundary');
  const boundaryValue = dividerCaller.nodes.find(node => node.type === 'VariableDeclarator' && node.id.name === boundaryBinding.name)?.init;
  assert.equal(boundaryValue?.type, 'ConditionalExpression');
  assert.deepEqual([text(boundaryValue.consequent), text(boundaryValue.alternate)], ['navigation', 'pane']);
  const dividerMember = node => node.callee.type === 'SequenceExpression' ? node.callee.expressions.at(-1) : node.callee;
  const dividerState = dividerFn.nodes.find(node => node.type === 'CallExpression' && key(dividerMember(node)?.property) === 'Ul');
  const dividerMerge = dividerFn.nodes.find(node => node.type === 'CallExpression' && node.arguments.some(value => text(value) === dividerClass));
  assert.ok(dividerState && dividerMerge);
  const dividerHarness = presentationHarness(bundle);
  const renderDivider = dividerHarness.compile(dividerFn, {
    [dividerMember(dividerState).object.name]: { Ul: () => false, _U: () => true },
    [dividerMember(dividerMerge).object.name]: { [key(dividerMember(dividerMerge).property)]: dividerHarness.modules.on57.A }
  });
  const portalMount = trackChildren.elements.find(node => node?.type === 'CallExpression' &&
    key(prop(node.arguments[1], 'container')?.property) === 'content');
  const endAction = trackChildren.elements.find(node => node?.type === 'ConditionalExpression' &&
    text(prop(node.consequent?.arguments?.[1], 'className')) === 'flex shrink-0 items-center pe-2');
  assert.ok(trackClass && portalMount && endAction, 'Native tab-strip portal and complete end-action carrier must remain siblings');
  const endActionProps = endAction.consequent.arguments[1], endActionClass = text(prop(endActionProps, 'className'));
  assert.equal(key(prop(endActionProps, 'children')?.property), 'contentTitlebarEndAction');
  const mountImport = bundle.imports(workspace)[portalMount.arguments[0].object.name];
  const mountRecord = bundle.module(mountImport.id), mountExport = bundle.exports(mountRecord)[key(portalMount.arguments[0].property)];
  const mountFn = mountExport?.type === 'Identifier' ? nodes(mountRecord.ast).find(node =>
    node.type === 'FunctionDeclaration' && node.id.name === mountExport.name) : mountExport;
  assert.ok(mountFn && nodes(mountFn).some(node => node.type === 'CallExpression' && key(node.callee?.property) === 'appendChild'),
    'Native titlebar portal host must still mount the actual shared content container');
  const portalHost = nodes(mountFn).find(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'div' &&
    text(prop(node.arguments[1], 'className')) === 'min-w-0 flex-1');
  assert.ok(portalHost, 'Native titlebar portal positioning carrier changed');
  const headerProviders = bundle.findModules(['contentTitlebarEndAction']).filter(record =>
    Object.values(bundle.imports(record)).some(imported => imported.id === toggle.id));
  const provider = unique(headerProviders, record => !!callToExport(bundle, record, toggle, exportedAs(bundle, toggle, toggleFn)) &&
    jsxNodes(record).some(node => prop(node.arguments[1], 'contentTitlebarEndAction')),
  'titlebar end-action provider');
  const toggleCall = callToExport(bundle, provider, toggle, exportedAs(bundle, toggle, toggleFn));
  const actionFn = nativeFunction(provider, toggleCall.start);
  const actionGroupClass = actionFn.nodes.map(text).find(value => value.startsWith('flex shrink-0 items-center gap-1.5'));
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
  const measured = slotFn.nodes.find(node => node.type === 'CallExpression' && nodes(prop(node.arguments[1], 'className')).some(value =>
    text(value) === 'col-span-full row-start-1 h-full min-w-max'));
  assert.ok(slotBaseClass && measured && slotFn.nodes.some(node => text(node) === 'justify-self-end [anchor-name:--titlebar-end-controls]'),
    'Native live measured end-slot carrier changed');
  const liveSlotClass = slotFn.nodes.map(text).find(value => value ===
    'pointer-events-none relative col-start-1 row-start-1 h-full w-full min-w-0 [container-type:inline-size]');
  const sizingSlotClass = slotFn.nodes.map(text).find(value => value ===
    'pointer-events-none invisible col-start-1 row-start-1 w-max justify-self-start [&_*]:![view-transition-name:none]');
  assert.ok(liveSlotClass && sizingSlotClass, 'Native non-measured slot must retain a separate invisible sizing sibling');
  assert.ok(slotFn.nodes.some(node => text(node) === 'pe-2') && slotFn.nodes.some(node => text(node) === 'h-full'), 'Native full-height end padding changed');
  const slotContentFn = nativeFunction(workspace, 'inline-flex h-full items-center gap-toolbar-action');
  const slotContentBaseClass = slotContentFn.nodes.map(text).find(value => value === 'inline-flex h-full items-center gap-toolbar-action');
  const slotContentLiveClass = slotContentFn.nodes.map(text).find(value => value === 'no-drag pointer-events-auto w-auto');
  const registeredEntryFn = nativeFunction(workspace, 'pointer-events-auto flex shrink-0 items-center no-drag');
  assert.ok(slotContentBaseClass && slotContentLiveClass && slotContentFn.nodes.some(node => text(node) === 'ms-auto') &&
    registeredEntryFn.nodes.some(node => text(node) === 'pointer-events-auto flex shrink-0 items-center no-drag'), 'Native live end-slot entry composition changed');
  const clipLayer = jsxNodes(workspace).find(node => text(prop(node.arguments[1], 'className')) === 'pointer-events-none absolute inset-0 [-webkit-app-region:initial]' &&
    prop(prop(node.arguments[1], 'style'), 'clipPath') && prop(node.arguments[1], 'children') === rightHeader);
  assert.ok(clipLayer, 'Native content titlebar must retain its separate clipping layer');
  const headerNode = marked(workspace, 'data-app-shell-titlebar'), headerFn = nativeFunction(workspace, headerNode.start);
  assert.ok(headerFn.nodes.map(text).some(value => value.split(' ').includes('me-1')), 'The native application-menu titlebar retains its logical end inset');
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

  const shellCss = shell.css;
  assert.ok(shellCss.includes('electron\\:before\\:bg-surface'), 'Native workspace canvas pseudo-element changed');
  assert.ok(shellCss.includes('[data-app-shell-surface-backing]:after{content:"";z-index:45;border-radius:inherit;box-shadow:inset 0 0 0 var(--border-width-hairline) var(--color-border)'),
    'Native backing must retain its separate frame edge above header content');
  const stripAssets = bundle.stylesheetAssets(['.scroll-px-1', '.bg-transparent']);
  assert.ok(stripAssets.length, 'Native tab-strip utility CSS changed');
  const css = [bundle.layerOrder, ...[...new Set([...shell.cssAssets, ...stripAssets])].map(asset => bundle.read(asset))].join('\n');
  assert.ok(css.includes('.bg-surface{background-color:var(--color-surface)}'));
  const newTabClass = text(prop(newTabNode.arguments[1], 'className'));
  const toolbarBaseClass = toolbarFn.nodes.map(text).find(value => value.startsWith('@container/browser-toolbar '));
  assert.ok(newTabClass.split(' ').includes('bg-surface') && toolbarBaseClass && !toolbarBaseClass.includes('bg-'));
  cached = { bundle, shell, records: { newTab, toolbar, browser, frame, workspace, activePage, toggle, strip }, css, shellCss,
    newTabClass, newTabInnerClass, newTabStyle, newTabInnerStyle, toolbarBaseClass, frameClass, tabsClass, tabsBodyClass, rightPanelClass, mainClass,
    rightHeaderClass, leftHeaderClass, trackClass, endActionClass, actionGroupClass, renderDivider,
    paneSurfaceClass, paneSurfaceClipClass, paneContentClass,
    registeredActionClass, endSlotClass: `${slotBaseClass} min-w-max ms-auto h-full shrink`,
    endMeasuredClass: `${text(prop(measured.arguments[1], 'className')?.arguments?.[0])} justify-self-end [anchor-name:--titlebar-end-controls] pe-2`, endPaddingClass: 'h-full',
    liveSlotClass: `${liveSlotClass} pe-2`, sizingSlotClass,
    endContentClass: `${slotContentBaseClass} ${slotContentLiveClass}`,
    registeredEntryClass: 'pointer-events-auto flex shrink-0 items-center no-drag ms-auto',
    clipLayerClass: text(prop(clipLayer.arguments[1], 'className')),
    portalHostClass: text(prop(portalHost.arguments[1], 'className')),
    stripClass: `${stripBase} h-[var(--app-shell-header-height,var(--height-toolbar))] gap-1.5 border-b border-default`,
    browserClass: text(prop(browserNode.arguments[1], 'className')),
    toolbarExport, frameExport, toolbarCall, frameCall };
  return cached;
};

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

// Source-derived presentation fixture, not an Electron guest or a live app
// screenshot. Outer slots supply deterministic full/split geometry; native
// inner classes, semantic boundaries, paint carriers and pseudo-CSS are real.
// Business content, navigation handlers, device emulation and data are absent.
export const browserSurfaceFixture = (native, { mode = 'dark', layout = 'split', registeredEndSlot = false, measureLiveContent = true,
  launcher = false, nativeHeaderInset = false, headerHeight = 52, direction = 'ltr' } = {}) => {
  const layoutClass = native.shell.backing.owner.nodes.map(text).find(value => value === 'relative flex min-h-0 min-w-0 flex-1');
  assert.ok(layoutClass, 'The native shell workspace must retain its layout class');
  const c = { Layout: layoutClass, Workspace: 'contents', MainContentClip: 'contents', MainContentSurface: native.mainClass,
    WorkspaceContent: native.shell.workspace.renderWrapper({ hasPageSurface: true }).props.className, MainContentViewport: native.shell.workspace.mainClasses };
  const backing = native.shell.backing.render({ sidebarOpen: true, leftInset: 340 });
  backing.props.id = 'paint';
  const toolbar = `<div class="relative h-full min-w-0"><div id="toolbar" data-viewer-density="compact" data-browser-sidebar-toolbar="true" class="${escape(native.toolbarBaseClass)}"><button id="back" disabled aria-label="Back" class="h-7 px-2 opacity-50">Back</button><input id="address" aria-label="Address" class="h-7 min-w-0 flex-1 rounded-xl border border-default bg-surface px-3" placeholder="Address"><button id="reload" aria-label="Reload" class="h-7 px-2">Reload</button></div></div>`;
  const styleText = values => Object.entries(values).map(([name, value]) => `${name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase())}:${value}`).join(';');
  const newTabMarkup = `<div id="new-tab" data-new-tab-scroll-root="true" class="${escape(native.newTabClass)}" style="${escape(styleText(native.newTabStyle))}"><div id="new-tab-content" class="${escape(native.newTabInnerClass)}" style="${escape(styleText(native.newTabInnerStyle))}"><label>Native component fixture<input id="new-tab-input" aria-label="New tab query" class="rounded-xl border border-default bg-surface p-2"></label><button id="new-tab-action" class="bg-primary-soft-alpha rounded-lg">Fixture action</button><div id="nested-card" class="bg-surface">Native nested control</div></div></div>`;
  const browserNavigation = launcher ? '' : `<div id="toolbar-carrier" class="${escape(native.frameClass)}">${toolbar}</div>`;
  const divider = native.renderDivider({ boundary: 'pane', region: 'content', className: 'inset-y-0 start-0' });
  divider.props.id = 'native-header-divider';
  const strip = (controller, id) => `<div id="${id}" data-app-shell-tab-row="true" role="presentation" class="${escape(native.stripClass)}"><div class="flex h-full min-w-0 flex-1 items-center"><div data-app-shell-tab-strip-controller="${controller}" role="presentation" class="flex h-full min-w-0 flex-1"><button role="tab" aria-selected="true">Fixture tab</button></div></div></div>`;
  const rightHeader = `<div id="right-header-slot" class="${escape(native.rightHeaderClass)}" data-app-shell-focus-area="right-panel"><div id="right-header-track" class="${escape(native.trackClass)} left-0">${nativeHeaderInset ? shellHtml(divider) : ''}<div id="right-header-portal" class="${escape(native.portalHostClass)}"><div id="shared-titlebar-content" class="contents" data-app-shell-titlebar-content="true">${strip('right', 'right-tabstrip')}</div></div><div id="right-header-actions" class="${escape(native.endActionClass)}"><div class="${escape(native.actionGroupClass)}"><button id="full-toggle" class="h-7 px-1" data-app-shell-workspace-layout-toggle="right-panel" data-app-shell-focus-area="right-panel" aria-pressed="false" aria-label="Full view">Full</button><button id="split-toggle" class="h-7 px-1" data-app-shell-workspace-layout-toggle="main" aria-pressed="true" aria-label="Split view">Split</button></div></div></div></div>`;
  const leftHeader = `<div id="left-header-slot" class="${escape(native.leftHeaderClass)}" data-app-shell-focus-area="main"><div class="min-w-0 flex-1">${strip('left', 'left-tabstrip')}</div><button id="left-header-action" class="pointer-events-auto h-7 px-1" aria-label="Left chat action">Chat</button></div>`;
  const registeredEnd = `<div id="registered-end-slot" data-app-shell-header-slot="end" class="${escape(native.endSlotClass)}"><div id="registered-end-measure" class="${escape(native.endMeasuredClass)}"><div id="registered-end-padding" class="${escape(native.endPaddingClass)}"><div id="registered-slot-content" class="${escape(native.endContentClass)}"><div id="registered-entry" class="${escape(native.registeredEntryClass)}"><div id="registered-action-root" data-app-shell-focus-area="main" class="${escape(native.registeredActionClass)}"><span aria-hidden="true" class="shrink-0" style="width:1px"></span></div></div></div></div></div></div>`;
  return `<!doctype html><html dir="${direction}" data-theme="${mode}" data-codex-window-type="electron" data-codex-os="win32"><head><meta charset="utf-8"><style>${native.css}</style><style>
    html,body{margin:0;width:100%;height:100%;overflow:hidden}#root{height:100vh}#frame{height:100%}
    #layout{position:relative;width:100%;height:100%;padding:0;--height-titlebar:44px;--app-shell-titlebar-height:${nativeHeaderInset ? headerHeight : 44}px;--app-shell-header-height:${nativeHeaderInset ? headerHeight : 44}px;--app-shell-navigation-rail-width:52px;--app-shell-window-radius:18px;--app-shell-left-panel-width:52px;--app-shell-application-menu-height:0px}
    #main-slot{position:absolute;inset:44px 0 0 340px;display:flex}#layout[data-fixture-layout="full"] #main-slot{left:0}
    #native-tabstrip{height:${headerHeight}px;flex-shrink:0;position:relative}#workspace-content{display:flex;flex:1;min-height:0}#viewport{display:flex;flex:1;min-width:0;min-height:0}#panes{display:flex;flex:1;min-height:0}
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
    html[dir="rtl"] #right-header-slot,html[dir="rtl"] #registered-end-slot{left:0;right:auto}
    #registered-slot-content{width:73px}#registered-action-root{width:69px}#registered-action-group{width:62px}
    #registered-action-group>button{width:28px;height:28px;padding:0}
    #browser-slots{position:absolute;inset:0;display:flex;flex-direction:column}#browser-content{position:relative;flex:1;min-height:0;overflow:hidden}
    #native-card{width:90px;height:40px;margin:18px}#new-tab input{width:220px;max-width:100%}#new-tab button{padding:8px}
    #unrelated-canvas,#unrelated-toolbar{position:fixed;top:4px;right:4px;width:96px;height:24px;overflow:hidden}#unrelated-toolbar{right:110px}
    #guest-host{position:fixed;right:12px;bottom:12px;width:110px;height:64px;z-index:20}#guest{display:block;width:100%;height:100%;border:0}
  </style></head><body><div id="root"><div id="active-page" class="contents" data-app-shell-active-page="true"><div id="layout" class="${c.Layout}" data-app-shell-workspace="true">${shellHtml(backing)}<div id="workspace" class="${c.Workspace}" data-app-shell-unified-tab-strip="true" data-app-shell-compact-page-gutter="true" data-app-shell-page-surface="true"><div id="main-slot"><div class="${c.MainContentClip}"><main id="main" class="outline-none ${c.MainContentSurface}" data-app-shell-main-surface="default" tabindex="-1"><div id="native-tabstrip" class="${nativeHeaderInset ? 'me-1' : ''}" data-app-shell-titlebar>Native tab fixture</div><div id="workspace-content" class="${c.WorkspaceContent}"><div id="viewport" class="${c.MainContentViewport}" data-app-shell-main-content-layout="default" data-app-shell-workspace-layout="${layout}"><div id="panes"><section id="thread-panel" role="tabpanel" data-app-shell-tab-panel-controller="left"><div id="native-card" class="bg-surface">Native card</div></section><section id="browser-panel" role="tabpanel" data-app-shell-tab-panel-controller="right"><div id="browser-root" class="${escape(native.browserClass)}" data-browser-sidebar-chrome-expanded="false" data-browser-sidebar-primary-focus-target="address" tabindex="-1"><div id="browser-slots">${browserNavigation}<div id="browser-content">${newTabMarkup}</div></div></div></section></div></div></div></main></div></div></div></div></div></div><div id="unrelated-canvas" data-new-tab-scroll-root="true" class="bg-surface-canvas">Other canvas</div><div id="unrelated-toolbar" class="${escape(native.frameClass)}">${toolbar.replaceAll('id="', 'data-other-id="')}</div><div id="guest-host" data-browser-sidebar-webview><iframe id="guest" title="External guest stand-in" srcdoc="&lt;style&gt;html,body{margin:0;background:rgb(15,180,117);height:100%;color:white}&lt;/style&gt;&lt;button&gt;Guest action&lt;/button&gt;"></iframe></div><script>const frame=document.createElement('div'),layoutRoot=document.getElementById('layout');frame.id='frame';frame.dataset.appShellFrame='true';frame.dataset.appShellPageSurface='true';layoutRoot.before(frame);frame.append(layoutRoot);const panel=document.getElementById('browser-panel'),tabs=document.createElement('div'),tabsBody=document.createElement('div'),rightPane=document.createElement('aside');rightPane.id='right-panel';rightPane.dataset.appShellFocusArea='right-panel';rightPane.className=${JSON.stringify(native.rightPanelClass)};tabs.id='browser-tabs';tabs.dataset.appShellTabs='true';tabs.className=${JSON.stringify(native.tabsClass)};tabsBody.id='tabs-body';tabsBody.className=${JSON.stringify(native.tabsBodyClass)};panel.before(rightPane);if(${JSON.stringify(nativeHeaderInset)}){const clip=document.createElement('div'),surface=document.createElement('div'),content=document.createElement('div');clip.id='right-pane-clip';clip.className=${JSON.stringify(native.paneSurfaceClipClass)};surface.id='right-pane-surface';surface.className=${JSON.stringify(native.paneSurfaceClass)}+' min-w-0 border-default '+(${JSON.stringify(direction)}==='rtl'?'right-0 border-r':'left-0 border-l');surface.style.width='100%';content.id='right-pane-content';content.className=${JSON.stringify(native.paneContentClass)};rightPane.append(clip);clip.append(surface);surface.append(content);content.append(tabs)}else rightPane.append(tabs);tabs.append(tabsBody);tabsBody.append(panel);document.getElementById('native-tabstrip').insertAdjacentHTML('beforeend',${JSON.stringify(leftHeader+rightHeader)});if(${JSON.stringify(registeredEndSlot)}){const header=document.getElementById('native-tabstrip');header.dataset.registeredEndSlot='true';header.dataset.appShellTitlebar='true';const clip=document.createElement('div');clip.id='right-header-clip';clip.className=${JSON.stringify(native.clipLayerClass)};clip.style.clipPath='inset(0px 81px 0px 6px)';clip.append(document.getElementById('right-header-slot'));header.append(clip);header.insertAdjacentHTML('beforeend',${JSON.stringify(registeredEnd)});const group=document.querySelector('#right-header-actions>div');group.id='registered-action-group';document.getElementById('registered-action-root').append(group);document.getElementById('right-header-actions').remove();document.getElementById('full-toggle').textContent='F';document.getElementById('split-toggle').textContent='S';if(!${JSON.stringify(measureLiveContent)}){const live=document.getElementById('registered-end-measure'),sizing=document.createElement('div'),clone=live.firstElementChild.cloneNode(true);sizing.id='registered-end-sizing';sizing.className=${JSON.stringify(native.sizingSlotClass)};sizing.setAttribute('aria-hidden','true');for(const element of [clone,...clone.querySelectorAll('[id]')])element.removeAttribute('id');sizing.append(clone);live.before(sizing);live.className=${JSON.stringify(native.liveSlotClass)};document.getElementById('registered-end-slot').style.width='81px'}}window.fixtureClicks=0;window.leftClicks=0;document.getElementById('full-toggle').onclick=()=>{fixtureClicks++;fixtureLayout('full')};document.getElementById('split-toggle').onclick=()=>{fixtureClicks++;fixtureLayout('split')};document.getElementById('left-header-action').onclick=()=>leftClicks++;document.getElementById('reload')?.addEventListener('click',()=>window.fixtureClicks++);document.getElementById('new-tab-action').onclick=()=>window.fixtureClicks++;window.fixtureLayout=value=>{document.getElementById('viewport').dataset.appShellWorkspaceLayout=value;document.getElementById('layout').dataset.fixtureLayout=value;document.getElementById('full-toggle')?.setAttribute('aria-pressed',String(value==='full'));document.getElementById('split-toggle')?.setAttribute('aria-pressed',String(value==='split'));if(${JSON.stringify(nativeHeaderInset)}){document.getElementById('right-header-slot').style.width=rightPane.getBoundingClientRect().width+'px';const surface=document.getElementById('right-pane-surface');surface.classList.toggle('border-l',value!=='full'&&${JSON.stringify(direction)}!=='rtl');surface.classList.toggle('border-r',value!=='full'&&${JSON.stringify(direction)}==='rtl')}};fixtureLayout(${JSON.stringify(layout)});</script></body></html>`;
};
