import assert from 'node:assert/strict';
import postcss from 'postcss';
import { loadNativeBundle, nodes, key, text, prop, nativeFunction } from './native-bundle-current-helper.mjs';

// These are presentation expressions from the installed renderer, not a shell
// implementation. Resolve only its literal class/boolean/offset operations;
// account state, navigation stores and the application factory never execute.
const evaluate = (node, values) => {
  if (node?.type === 'Literal') return node.value;
  if (node?.type === 'Identifier' && Object.hasOwn(values, node.name)) return values[node.name];
  if (node?.type === 'UnaryExpression' && node.operator === '!') return !evaluate(node.argument, values);
  if (node?.type === 'LogicalExpression' && node.operator === '&&') return evaluate(node.left, values) && evaluate(node.right, values);
  if (node?.type === 'LogicalExpression' && node.operator === '||') return evaluate(node.left, values) || evaluate(node.right, values);
  if (node?.type === 'ConditionalExpression') return evaluate(node.test, values) ? evaluate(node.consequent, values) : evaluate(node.alternate, values);
  if (node?.type === 'CallExpression') return node.arguments.map(value => evaluate(value, values)).filter(value => typeof value === 'string' && value).join(' ');
  assert.fail(`Native shell presentation expression changed: ${node?.type}`);
};
const one = (values, message) => { assert.equal(values.length, 1, message); return values[0]; };
const isTrue = node => node?.type === 'UnaryExpression' && node.operator === '!' && node.argument?.value === 0 || node?.value === true;
const assignment = (owner, name, predicate = () => true) => one(owner.nodes.filter(node =>
  (node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && node.left.name === name ||
   node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.id.name === name) &&
  predicate(node.type === 'VariableDeclarator' ? node.init : node.right)), `Native shell binding ${name} changed`);
const value = node => node.type === 'VariableDeclarator' ? node.init : node.right;

export const loadNativeShell = (options = {}) => {
  const bundle = options.bundle || loadNativeBundle(options);
  const record = one(bundle.findModules(['"data-app-shell-surface-backing"']), 'Native shell backing module changed');
  const call = one(nodes(record.ast).filter(node => node.type === 'CallExpression' && prop(node.arguments[1], 'data-app-shell-surface-backing')),
    'Native shell backing renderer changed');
  const props = call.arguments[1], owner = nativeFunction(record, call.start);
  assert.ok(isTrue(prop(props, 'aria-hidden')) && isTrue(prop(props, 'data-app-shell-surface-backing')) && !prop(props, 'children'),
    'Native shell backing must remain an empty decorative leaf');
  const classExpression = prop(props, 'className');
  assert.equal(classExpression.type, 'CallExpression', 'Native shell backing class combiner changed');
  const [baseClass, rounded] = classExpression.arguments;
  assert.ok(text(baseClass).split(' ').includes('bg-surface') && text(baseClass).split(' ').includes('pointer-events-none'));
  assert.equal(rounded.type, 'LogicalExpression');
  assert.equal(rounded.left.type, 'Identifier');
  assert.equal(text(rounded.right), 'rounded-e-xl-base');
  const inset = prop(prop(props, 'style'), 'insetInlineStart');
  assert.equal(inset.type, 'ConditionalExpression');
  assert.equal(inset.test.type, 'Identifier');
  assert.equal(inset.consequent.type, 'Identifier');
  assert.equal(inset.alternate.value, 0);
  const backingBinding = one(owner.nodes.filter(node => node.type === 'AssignmentExpression' &&
    node.right.type === 'LogicalExpression' && node.right.right === call), 'Native backing presence branch changed');
  const workspaceCall = one(owner.nodes.filter(node => node.type === 'CallExpression' && isTrue(prop(node.arguments[1], 'data-app-shell-workspace'))),
    'Native backing workspace relationship changed');
  const workspaceChildren = prop(workspaceCall.arguments[1], 'children');
  assert.equal(workspaceChildren.type, 'ArrayExpression');
  assert.equal(workspaceChildren.elements[0].name, backingBinding.left.name, 'Backing must remain the first workspace sibling');
  const frameProps = one(owner.nodes.filter(node => node.type === 'ObjectExpression' && isTrue(prop(node, 'data-app-shell-frame'))),
    'Native window frame attributes changed');
  assert.equal(prop(frameProps, 'data-app-shell-page-surface').name, backingBinding.right.left.name,
    'Native frame and backing must use the same page-surface branch');
  const frameClass = prop(frameProps, 'className');
  const frameClassExpression = value(assignment(owner, frameClass.name, node => node?.type === 'CallExpression'));
  const frameBinding = one(owner.nodes.filter(node => node.type === 'AssignmentExpression' && node.right === frameProps),
    'Native frame props binding changed');
  const frameAlias = one(owner.nodes.filter(node => node.type === 'VariableDeclarator' && node.init?.name === frameBinding.left.name),
    'Native frame props transport changed');
  const frameCall = one(owner.nodes.filter(node => node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression' &&
    node.arguments[1].properties.some(item => item.type === 'SpreadElement' && item.argument.name === frameAlias.id.name)),
  'Native frame render association changed');
  const frameTransport = one(nodes(record.ast).filter(node => node.type === 'FunctionDeclaration' && node.id.name === frameCall.arguments[0]?.name),
    'Native frame transport renderer changed');
  assert.ok(nodes(frameTransport).some(node => node.type === 'CallExpression' && key(node.arguments[0]?.property) === 'div' &&
    node.arguments[1]?.properties.some(item => item.type === 'SpreadElement')),
  'Native frame props must reach the motion div');
  const renderFrame = ({ hasPageSurface = true, applicationMenuBar = false, sidebarOpen = true,
    featureNavigation = true, trailingSidebar = false, children = null } = {}) => {
    const values = {
      [prop(frameProps, 'data-app-shell-page-surface').name]: hasPageSurface,
      [prop(frameProps, 'data-app-shell-application-menu-bar').name]: applicationMenuBar
    };
    // The third dynamic input sets only the application-menu header inset.
    for (const node of nodes(frameClassExpression).filter(node => node.type === 'Identifier')) {
      if (!Object.hasOwn(values, node.name)) values[node.name] = false;
    }
    return { tag: 'div', props: {
      className: evaluate(frameClassExpression, values),
      'data-app-shell-frame': true, 'data-app-shell-page-surface': hasPageSurface,
      'data-app-shell-application-menu-bar': applicationMenuBar, 'data-app-shell-responsive-sidebar': false,
      'data-app-shell-feature-navigation': featureNavigation, 'data-app-shell-sidebar-open': sidebarOpen,
      'data-app-shell-trailing-sidebar-visible': trailingSidebar, children
    } };
  };
  const renderBacking = ({ sidebarOpen = true, leftInset = 308, trailingSidebar = false } = {}) => ({ tag: 'div', props: {
    'aria-hidden': true, 'data-app-shell-surface-backing': true,
    className: evaluate(classExpression, { [rounded.left.name]: trailingSidebar }),
    style: { insetInlineStart: `${evaluate(inset, { [inset.test.name]: sidebarOpen, [inset.consequent.name]: leftInset })}px` }
  } });

  const workspaceRecord = one(bundle.findModules(['"data-app-shell-main-content-layout"']), 'Native main-content layout module changed');
  const mainCall = one(nodes(workspaceRecord.ast).filter(node => node.type === 'CallExpression' && prop(node.arguments[1], 'data-app-shell-main-content-layout')),
    'Native main-content layout renderer changed');
  const layout = nativeFunction(workspaceRecord, mainCall.start);
  const mainBinding = one(layout.nodes.filter(node => node.type === 'AssignmentExpression' && node.right === mainCall), 'Native main-content result binding changed');
  const wrapperCall = one(layout.nodes.filter(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'div' &&
    prop(node.arguments[1], 'children')?.type === 'ArrayExpression' && prop(node.arguments[1], 'children').elements[0]?.name === mainBinding.left.name),
  'Native main-content direct wrapper changed');
  const wrapperClass = prop(wrapperCall.arguments[1], 'className');
  assert.equal(wrapperClass.type, 'Identifier');
  const wrapperClasses = value(assignment(layout, wrapperClass.name, node => node?.type === 'CallExpression'));
  const base = text(wrapperClasses.arguments[0]);
  assert.ok(base.split(' ').includes('isolate') && base.split(' ').includes('overflow-hidden'), 'Native main wrapper geometry changed');
  const beforeBinding = one(layout.nodes.filter(node => node.type === 'VariableDeclarator' &&
    text(node.init?.right).includes('electron:before:bg-surface')), 'Native main wrapper pseudo paint branch changed');
  const before = beforeBinding.init;
  assert.equal(before.type, 'LogicalExpression');
  assert.equal(before.left.type, 'LogicalExpression');
  assert.equal(before.left.left.type, 'UnaryExpression');
  assert.equal(before.left.left.operator, '!');
  assert.equal(before.left.left.argument.type, 'Identifier');
  assert.equal(before.left.right.type, 'Identifier');
  assert.ok(wrapperClasses.arguments.some(node => node.name === beforeBinding.id.name), 'Native wrapper no longer owns its before class');
  const beforeClasses = text(before.right);
  const mainClasses = text(value(assignment(layout, prop(mainCall.arguments[1], 'className').name,
    node => node?.type === 'CallExpression')).arguments[0]);
  const paintedMain = one(layout.nodes.filter(node => node.type === 'CallExpression' &&
    text(prop(node.arguments[1], 'data-app-shell-main-surface')) === 'default'), 'Native painted main renderer changed');
  const paintedMainClasses = text(value(assignment(layout, prop(paintedMain.arguments[1], 'className').name,
    node => node?.type === 'CallExpression')).arguments[0]);
  const renderWrapper = ({ hasPageSurface = false, unifiedTabs = true, children = null } = {}) => ({ tag: 'div', props: {
    className: [base, evaluate(before, { [before.left.left.argument.name]: hasPageSurface, [before.left.right.name]: unifiedTabs })].filter(Boolean).join(' '),
    children: { tag: 'div', props: { 'data-app-shell-main-content-layout': 'default', children } }
  } });
  const cssAssets = [...new Set([...bundle.baseStylesheets(), ...bundle.stylesheetAssets(['electron\\:before\\:bg-surface']),
    ...bundle.stylesheetAssets(['rounded-s-xl-base'])])];
  assert.ok(cssAssets.length && cssAssets.some(asset => bundle.read(asset).includes('electron\\:before\\:bg-surface')),
    'Native main wrapper pseudo CSS changed');
  const css = `${bundle.layerOrder}\n${cssAssets.map(asset => bundle.read(asset)).join('\n')}`;
  const framePaint = { dockedFill: [], windowFill: [], gradient: [], hairline: [] };
  postcss.parse(css).walkDecls(declaration => {
    if (declaration.prop === '--app-shell-sidebar-docked-background') framePaint.dockedFill.push(declaration.value);
    if (declaration.prop === '--app-shell-page-window-fill') framePaint.windowFill.push(declaration.value);
    const selector = declaration.parent.selector || '';
    if (selector.includes('[data-app-shell-frame]') && selector.includes('[data-app-shell-page-surface=true]')) {
      if (declaration.prop === 'background-image' && declaration.value.startsWith('linear-gradient(var(--app-shell-sidebar-docked-background)')) framePaint.gradient.push(selector);
      if (selector.includes('[data-app-shell-surface-backing]:after') && declaration.prop === 'box-shadow') framePaint.hairline.push(declaration.value);
    }
  });
  assert.ok(framePaint.dockedFill.some(value => value.includes('var(--color-surface) 65%')), 'Native frame docked gradient tint changed');
  assert.ok(framePaint.windowFill.some(value => value.includes('var(--color-surface-secondary) 85%') &&
    value.includes('var(--color-surface-tertiary) 80%')), 'Native frame light/dark window fill changed');
  assert.ok(framePaint.gradient.length && framePaint.hairline.some(value => value.includes('var(--border-width-hairline)')),
    'Native frame background and backing hairline ownership changed');
  const fadeOwner = nativeFunction(workspaceRecord, '--app-shell-content-fade-height');
  const fadeCall = one(fadeOwner.nodes.filter(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'div' &&
    isTrue(prop(node.arguments[1], 'aria-hidden')) && !prop(node.arguments[1], 'children')), 'Native content top fade leaf changed');
  const fadeClass = prop(fadeCall.arguments[1], 'className');
  const fadeClassCall = value(assignment(fadeOwner, fadeClass.name, node => node?.type === 'CallExpression'));
  const fadeClasses = text(fadeClassCall.arguments[0]);
  const visibleOpacity = one(fadeOwner.nodes.map(text).filter(name => name.startsWith('opacity-(--app-shell-content-fade-opacity,1)')),
    'Native content top fade opacity changed');
  const inactiveOpacity = one(fadeOwner.nodes.map(text).filter(name => name.startsWith('opacity-(--app-shell-content-fade-opacity,0)')),
    'Native inactive content top fade opacity changed');
  assert.ok(layout.nodes.some(node => node.type === 'CallExpression' && node.arguments[0]?.name === fadeOwner.ast.id.name),
    'Native main layout no longer consumes the top fade renderer');
  const viewerRecord = one(bundle.findModules(['"data-viewer-content-fade"', '--app-shell-content-fade']), 'Native viewer header fade owner changed');
  const viewerCall = one(nodes(viewerRecord.ast).filter(node => node.type === 'CallExpression' &&
    isTrue(prop(node.arguments[1], 'aria-hidden')) && text(prop(node.arguments[1], 'className')).includes('--app-shell-content-fade')),
  'Native viewer header decorative fade changed');
  const viewerOwner = nativeFunction(viewerRecord, viewerCall.start);
  const viewerHeader = one(viewerOwner.nodes.filter(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'header' &&
    prop(node.arguments[1], 'data-viewer-content-fade')), 'Native viewer header semantic owner changed');
  const viewerBinding = one(viewerOwner.nodes.filter(node => node.type === 'AssignmentExpression' &&
    node.right.type === 'ConditionalExpression' && node.right.consequent === viewerCall), 'Native viewer contentFade gate changed');
  assert.ok(prop(viewerHeader.arguments[1], 'children').elements.some(node => node?.name === viewerBinding.left.name),
    'Native viewer header no longer directly owns its fade leaf');
  const renderMainFade = ({ visible = true, hidden = false, disabled = false } = {}) => ({ tag: 'div', props: {
    'aria-hidden': true, hidden, className: [fadeClasses, visible ? visibleOpacity : inactiveOpacity, disabled && 'hidden'].filter(Boolean).join(' ')
  } });
  const renderViewerFade = () => ({ tag: 'div', props: { 'aria-hidden': true, className: text(prop(viewerCall.arguments[1], 'className')) } });
  return { bundle, css, cssAssets,
    frame: { record, props: frameProps, transport: frameTransport, paint: framePaint, render: renderFrame },
    backing: { record, owner, call, classes: text(baseClass), render: renderBacking, workspaceCall },
    workspace: { record: workspaceRecord, owner: layout, call: wrapperCall, classes: base,
      wrapperClasses: base, mainClasses, paintedMainClasses, beforeClasses, renderWrapper, mainCall },
    fades: { main: { record: workspaceRecord, owner: fadeOwner, classes: fadeClasses, render: renderMainFade },
      viewer: { record: viewerRecord, owner: viewerOwner, render: renderViewerFade } } };
};

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
export const shellHtml = tree => {
  if (tree == null || tree === false) return '';
  if (Array.isArray(tree)) return tree.map(shellHtml).join('');
  if (typeof tree !== 'object') return escape(tree);
  const { tag, props } = tree;
  const attributes = Object.entries(props).filter(([name, value]) => !['children', 'style'].includes(name) && value !== undefined &&
    (value !== false || /^(?:data-|aria-)/.test(name)))
    .map(([name, value]) => `${name === 'className' ? 'class' : name}="${escape(value === true ? 'true' : value)}"`).join(' ');
  const style = Object.entries(props.style || {}).map(([name, value]) => `${name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}:${value}`).join(';');
  return `<${tag} ${attributes}${style ? ` style="${escape(style)}"` : ''}>${shellHtml(props.children)}</${tag}>`;
};
