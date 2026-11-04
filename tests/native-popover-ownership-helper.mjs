import assert from 'node:assert/strict';
import { key, loadNativeBundle, nativeFunction, nativeObject, nodes, ownNodes, presentationHarness, prop, text } from './native-bundle-current-helper.mjs';

export const owner = (ast, target) => nodes(ast).filter(node => /^(?:Function|ArrowFunction)/.test(node.type) &&
  node.start <= target.start && node.end >= target.end).sort((a, b) => a.end - a.start - (b.end - b.start))[0];
export const aliases = fn => {
  const values = new Map();
  for (const node of nodes(fn)) {
    const name = node.type === 'VariableDeclarator' && node.id.type === 'Identifier' ? node.id.name
      : node.type === 'AssignmentExpression' && node.left.type === 'Identifier' ? node.left.name : null;
    if (name) values.set(name, [...(values.get(name) || []), node.init || node.right]);
  }
  const reaches = (expression, target, visited = new Set()) => expression === target || expression?.type === 'Identifier' && !visited.has(expression.name) &&
    (values.get(expression.name) || []).some(value => reaches(value, target, new Set([...visited, expression.name])));
  return reaches;
};

export const loadPopoverNative = archive => {
  const bundle = loadNativeBundle({ archive }), harness = presentationHarness(bundle);
  const compileSelected = (fn, additions = {}) => {
    // Large caller modules import many business services. Supply only imports
    // referenced by this selected pure renderer and keep explicit transports
    // local to this fixture; unrelated factories are never evaluated.
    const imports = bundle.imports(fn.record), used = new Set(fn.nodes.filter(node => node.type === 'Identifier').map(node => node.name));
    const declarations = ownNodes(fn.record.ast).filter(node => node.type === 'VariableDeclarator' && node.id.type === 'Identifier' &&
      imports[node.id.name] && used.has(node.id.name) && !Object.hasOwn(additions, node.id.name));
    const record = { ...fn.record, ast: { ...fn.record.ast, body: { ...fn.record.ast.body,
      body: [{ type: 'VariableDeclaration', kind: 'var', declarations }] } } };
    return harness.compile({ ...fn, record }, additions);
  };
  const one = (needles, predicate = () => true) => {
    const matches = bundle.findModules(needles).filter(predicate);
    assert.equal(matches.length, 1, `Native presentation module changed: ${needles.join('/')}`);
    return matches[0];
  };
  const exported = (record, fn) => {
    const name = Object.entries(bundle.exports(record)).find(([, value]) => value.type === 'Identifier' && value.name === fn.ast.id?.name)?.[0];
    assert.ok(name, 'Native presentation renderer export changed');
    return name;
  };
  const namespace = (record, id) => Object.entries(bundle.imports(record)).find(([, imported]) => imported.id === id)?.[0];
  const importedCall = (record, call, id, exportName) => {
    const tag = call?.arguments?.[0];
    return tag?.type === 'MemberExpression' && bundle.imports(record)[tag.object.name]?.id === id && key(tag.property) === exportName;
  };
  const moduleObject = (record, local) => {
    const imported = bundle.imports(record)[local];
    assert.ok(imported, 'Native CSS module import changed');
    const dependency = bundle.module(imported.id), expression = bundle.exports(dependency)[imported.exported || 'A'];
    return nativeObject(dependency, expression);
  };
  const definitions = record => Object.fromEntries(record.ast.body.body.filter(node => node.type === 'VariableDeclaration')
    .flatMap(node => node.declarations).filter(node => node.id.type === 'Identifier').map(node => [node.id.name, node.init]));
  const classCall = (fn, predicate) => fn.nodes.find(node => node.type === 'CallExpression' && node.arguments.some(predicate));

  const popoverRecord = one(['data-slot', 'popover-content', 'text-default z-50 flex origin-']);
  const popover = nativeFunction(popoverRecord, '"popover-content"'), popAlias = exported(popoverRecord, popover);
  const floatingRecord = one(['floatingSurface', 'singleLineSurface', 'asChild'], record =>
    nodes(record.ast).some(fn => fn.type === 'FunctionDeclaration' && fn !== record.ast &&
      nodes(fn).some(node => node.type === 'ObjectPattern' && prop({ type: 'ObjectExpression', properties: node.properties }, 'asChild')) &&
      nodes(fn).some(node => node.type === 'MemberExpression' && key(node.property) === 'cloneElement') &&
      nodes(fn).some(node => node.type === 'MemberExpression' && key(node.property) === 'floatingSurface')));
  const floating = nativeFunction(floatingRecord, '.floatingSurface'), floatAlias = exported(floatingRecord, floating);
  const renderFloating = harness.load(floatingRecord.id)[floatAlias];
  const floatingModule = floating.nodes.find(node => node.type === 'MemberExpression' && key(node.property) === 'floatingSurface').object;
  const floatingClasses = moduleObject(floatingRecord, floatingModule.object.name);

  const menuRecord = one(['min-w-[120px]', 'railMenu', 'rounded-full bg-surface-elevated-secondary/90']);
  const menuExports = bundle.exports(menuRecord);
  const menuFn = nativeFunction(menuRecord, 'rounded-full bg-surface-elevated-secondary/90');
  const renderMenu = compileSelected(menuFn);
  const menuWidthExpression = menuExports.xk;
  const menuWidthDeclaration = nodes(menuRecord.ast).find(node => node.type === 'FunctionDeclaration' && node.id.name === menuWidthExpression?.name);
  assert.ok(menuWidthDeclaration, 'Native menu width renderer export changed');
  const menuWidth = nativeFunction(menuRecord, menuWidthDeclaration.start + 1);
  const widthMapName = menuWidth.nodes.find(node => node.type === 'MemberExpression' && node.computed && node.object.type === 'Identifier')?.object.name;
  const renderMenuWidth = compileSelected(menuWidth, { [widthMapName]: nativeObject(menuRecord, definitions(menuRecord)[widthMapName]) });
  const sizeMap = nodes(popoverRecord.ast).find(node => node.type === 'VariableDeclarator' && prop(node.init, 'anchor') && prop(node.init, 'railMenu'));
  assert.ok(sizeMap, 'Native Popover size map changed');
  const sizeClasses = Object.fromEntries(sizeMap.init.properties.map(item => [key(item.key), text(item.value) ||
    (item.value.type === 'CallExpression' && text(item.value.arguments[0]) === 'railMenu' ? renderMenuWidth('railMenu') : assert.fail('Native Popover size map is no longer static'))]));
  const contentCall = popover.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'data-slot')) === 'popover-content');
  assert.ok(contentCall?.arguments[0]?.type === 'MemberExpression', 'Native Radix Popover content transport changed');
  const radix = props => props.asChild ? ({ tag: props.children.tag, props: { ...props.children.props, ...props, role: 'dialog',
    className: [props.children.props.className, props.className].filter(Boolean).join(' '),
    style: { ...props.children.props.style, ...props.style }, children: props.children.props.children } })
    : ({ tag: 'div', props: { role: 'dialog', ...props } });
  // Bypass only portal/focus/zoom transports. The actual installed renderer
  // still selects every class, width, styled/unstyled and menu variant.
  const popBindings = {
    [sizeMap.id.name]: sizeClasses,
    [contentCall.arguments[0].object.name]: { [key(contentCall.arguments[0].property)]: radix },
    [namespace(popoverRecord, menuRecord.id)]: { MX: renderMenu, xk: renderMenuWidth },
    [namespace(popoverRecord, 'wD9O')]: { dz: () => 1 },
    [namespace(popoverRecord, 'giDA')]: { J: harness.react.createContext({ id: undefined }) },
    [namespace(popoverRecord, 'EGCJ')]: { a: harness.react.createContext(undefined), f: () => ({ onOpenAutoFocus() {}, onInteractOutside() {}, onCloseAutoFocus() {} }) },
    [namespace(popoverRecord, 'zd8w')]: { ...harness.react, useState: value => [typeof value === 'function' ? value() : value, () => {}] }
  };
  const renderPopover = options => compileSelected(popover, popBindings)({ disablePortal: true, ...options });

  const editorRecord = one(['visualization.annotationControls.title', 'cursor-grab']);
  const editor = nativeFunction(editorRecord, 'visualization.annotationControls.title');
  const editorPopover = editor.nodes.find(node => node.type === 'CallExpression' && importedCall(editorRecord, node, popoverRecord.id, popAlias) && prop(node.arguments[1], 'unstyled'));
  const innerFloating = editor.nodes.find(node => node.type === 'CallExpression' && importedCall(editorRecord, node, floatingRecord.id, floatAlias));
  const surfaceCall = classCall(editor, argument => /^surface-[\w-]+$/.test(text(argument)));
  const reaches = aliases(editor.ast);
  assert.ok(editorPopover && innerFloating && surfaceCall && reaches(prop(innerFloating.arguments[1], 'className'), surfaceCall),
    'Native Design controls inner FloatingSurface ownership changed');
  const editorClasses = surfaceCall.arguments.map(text).filter(Boolean).join(' ');
  const editorSurface = surfaceCall.arguments.map(text).find(value => /^surface-[\w-]+$/.test(value));
  assert.ok(bundle.stylesheetAssets([`.${editorSurface}{--radius-token-composer-single-line:`]).length,
    'Native Design controls must retain its native composer radius token');

  const toolbarRecord = one(['pointer-events-auto flex w-fit max-w-full overflow-hidden']);
  const toolbar = nativeFunction(toolbarRecord, 'pointer-events-auto flex w-fit max-w-full overflow-hidden');
  const toolbarAlias = exported(toolbarRecord, toolbar);
  const toolbarBase = toolbar.nodes.map(text).find(value => value === 'pointer-events-auto flex w-fit max-w-full overflow-hidden');
  const toolbarPaint = toolbar.nodes.map(text).find(value => value.includes('min-w-0 flex-wrap items-center rounded-xl bg-surface-elevated-secondary'));
  assert.ok(toolbarBase && toolbarPaint, 'Native independent toolbar carrier changed');
  // The former About you summary is now the Memory summary dialog. It still
  // imports the same independent toolbar and transparent Popover contracts.
  const aboutRecord = one(['MemorySummaryDialog', `"${toolbarRecord.id}"`, `"${popoverRecord.id}"`]);
  const toolbarCall = nodes(aboutRecord.ast).find(node => node.type === 'CallExpression' && importedCall(aboutRecord, node, toolbarRecord.id, toolbarAlias));
  const aboutPopover = nodes(aboutRecord.ast).find(node => node.type === 'CallExpression' && importedCall(aboutRecord, node, popoverRecord.id, popAlias) && prop(node.arguments[1], 'unstyled'));
  const controlNamespace = Object.entries(bundle.imports(editorRecord)).find(([, value]) => {
    const source = bundle.module(value.id).source;
    return source.includes('cursor-interaction items-center gap-2 overflow-hidden px-3 text-start') && source.includes('min-w-0 appearance-none border-0 bg-transparent');
  });
  assert.ok(controlNamespace, 'Native Design controls input/select module changed');
  const controls = bundle.module(controlNamespace[1].id);
  const selectClass = classCall({ nodes: nodes(controls.ast) }, argument => text(argument).includes('cursor-interaction items-center gap-2 overflow-hidden px-3 text-start'))?.arguments.map(text).filter(Boolean).join(' ');
  const inputClass = classCall({ nodes: nodes(controls.ast) }, argument => text(argument).startsWith('min-w-0 appearance-none border-0 bg-transparent'))?.arguments.map(text).filter(Boolean).join(' ');
  assert.ok(inputClass && selectClass, 'Native Design controls input/select class contract changed');

  const switchRecord = one(['thumbClassName', 'role:"switch"']);
  const switchFn = nativeFunction(switchRecord, 'role:"switch"');
  const switchTrack = nativeFunction(switchRecord, 'relative inline-flex shrink-0');
  const switchMaps = [...new Set(switchTrack.nodes.filter(node => node.type === 'MemberExpression' && node.computed && node.object.type === 'Identifier')
    .map(node => node.object.name))].filter(name => definitions(switchRecord)[name]?.type === 'ObjectExpression');
  const renderSwitchTrack = compileSelected(switchTrack, Object.fromEntries(switchMaps.map(name => [name, nativeObject(switchRecord, definitions(switchRecord)[name])])));
  const renderSwitch = compileSelected(switchFn, { [switchTrack.ast.id.name]: renderSwitchTrack });

  const avatarMaterialRecord = one(['data-avatar-overlay-material-variant', 'QuickChatMaterial', 'data-avatar-overlay-native-surface-id']);
  const avatarMaterial = nativeFunction(avatarMaterialRecord, 'data-avatar-overlay-material-variant');
  const renderAvatarMaterial = compileSelected(avatarMaterial);
  const avatarRecord = one(['floodColor', 'data-avatar-overlay-material-variant', 'reaction-picker']);
  const avatarReaction = nativeFunction(avatarRecord, 'floodColor');
  const reactionCall = avatarReaction.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'variant')) === 'reaction-picker');
  assert.ok(reactionCall && importedCall(avatarRecord, reactionCall, avatarMaterialRecord.id, exported(avatarMaterialRecord, avatarMaterial)), 'Native reaction picker material call changed');
  const renderAvatarReaction = compileSelected(avatarReaction, {
    [reactionCall.arguments[0].object.name]: { [key(reactionCall.arguments[0].property)]: renderAvatarMaterial }
  });
  const avatarPopovers = nodes(avatarRecord.ast).filter(node => node.type === 'CallExpression' && importedCall(avatarRecord, node, popoverRecord.id, popAlias) && prop(node.arguments[1], 'unstyled'));

  const checkoutRecord = one(['chatgpt.inline_credit_checkout.payment.title', 'defaultMessage:']);
  const checkout = nativeFunction(checkoutRecord, 'chatgpt.inline_credit_checkout.payment.title');
  const checkoutRootCall = checkout.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'presentation')) === 'inline');
  const checkoutShellRecord = bundle.module(bundle.imports(checkoutRecord)[checkoutRootCall?.arguments[0]?.object.name]?.id);
  const checkoutShell = nativeFunction(checkoutShellRecord, 'data-checkout-presentation');
  const renderCheckoutShell = compileSelected(checkoutShell);
  const renderCheckout = compileSelected(checkout, {
    [checkoutRootCall.arguments[0].object.name]: { [key(checkoutRootCall.arguments[0].property)]: renderCheckoutShell }
  });
  const checkoutPaintCall = classCall(checkout, argument => argument.type === 'MemberExpression' && key(argument.property) === 'surface');
  const checkoutPaint = checkoutPaintCall?.arguments.find(argument => argument.type === 'MemberExpression' && key(argument.property) === 'surface');
  assert.ok(checkoutRootCall && checkoutPaint, 'Native inline checkout painted root changed');
  const checkoutClasses = moduleObject(checkoutRecord, checkoutPaint.object.object.name);
  const checkoutDialogRecord = one(['checkout.inline.label', `"${checkoutRecord.id}"`, `"${popoverRecord.id}"`]);
  const checkoutPageExport = exported(checkoutRecord, checkout);
  const checkoutCall = nodes(checkoutDialogRecord.ast).find(node => node.type === 'CallExpression' && importedCall(checkoutDialogRecord, node, checkoutRecord.id, checkoutPageExport));
  const checkoutPopover = nodes(checkoutDialogRecord.ast).find(node => node.type === 'CallExpression' && importedCall(checkoutDialogRecord, node, popoverRecord.id, popAlias) && prop(node.arguments[1], 'asChild'));

  const avatarClass = avatarMaterial.nodes.find(node => node.type === 'MemberExpression' && key(node.property) === 'Material');
  const avatarClasses = moduleObject(avatarMaterialRecord, avatarClass.object.object.name);
  const checkoutRootClass = checkoutShell.nodes.find(node => node.type === 'MemberExpression' && key(node.property) === 'root');
  const checkoutRootClasses = moduleObject(checkoutShellRecord, checkoutRootClass.object.object.name);
  const stylesheetAssets = [floatingClasses.floatingSurface, editorSurface, avatarClasses.Material, checkoutClasses.surface, checkoutRootClasses.root].map(name => {
    const assets = bundle.stylesheetAssets([`.${name}`]);
    assert.ok(assets.length, `Native painted component stylesheet changed: ${name}`);
    return assets[0];
  });
  const css = `${bundle.layerOrder}\n${[...new Set([...bundle.baseStylesheets(), ...stylesheetAssets])].map(asset => bundle.read(asset)).join('\n')}`;
  return { css, renderPopover, renderFloating, renderSwitch, editorPopover, editorFunction: editor.ast, innerFloating, reaches,
    editorClasses, floatingClass: floatingClasses.floatingSurface, toolbarClasses: `${toolbarBase} ${toolbarPaint}`, inputClass, selectClass,
    aboutAst: aboutRecord.ast, aboutPopover, toolbarCall, toolbar,
    avatarAst: avatarRecord.ast, avatarReaction, avatarPopovers, renderAvatarReaction, renderAvatarMaterial,
    checkoutDialogAst: checkoutDialogRecord.ast, checkoutCall, checkoutPopover, renderCheckout,
    checkoutSecondary: checkoutClasses.secondary,
    editorHeader: editor.nodes.map(text).find(value => value.startsWith('flex h-toolbar shrink-0 cursor-grab')),
    editorHeading: editor.nodes.map(text).find(value => value.startsWith('flex h-token-button-composer min-w-0 flex-1')) };
};
