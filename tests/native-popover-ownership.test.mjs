import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseAst } from 'rollup/parseAst';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const lock = JSON.parse(fs.readFileSync(new URL('../docs/native-asar-provenance.json', import.meta.url), 'utf8'));
const archive = process.env.CODEX_LOCAL_ASAR || path.join(process.env.ProgramFiles || '', 'WindowsApps', lock.packageDirectoryName, lock.asarRelativePath);
const skip = !fs.existsSync(archive) && 'Requires the audited installed ASAR';
const key = node => node?.name ?? node?.value;
const text = node => node?.type === 'TemplateLiteral' ? node.quasis.map(part => part.value.cooked).join(' ') : node?.type === 'Literal' ? String(node.value) : '';
const prop = (node, name) => node?.type === 'ObjectExpression' ? node.properties.find(item => item.type === 'Property' && key(item.key) === name)?.value : undefined;
const nodes = tree => {
  const result = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string') result.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(tree);
  return result;
};
const funcAt = (source, anchor) => {
  const at = typeof anchor === 'number' ? anchor : source.indexOf(anchor);
  assert.ok(at >= 0, `Native function anchor changed: ${anchor}`);
  const start = source.lastIndexOf('function ', at), end = source.indexOf('function ', at + 1);
  const chunk = source.slice(start, end < 0 ? source.length : end);
  const ast = parseAst(chunk).body.find(node => node.type === 'FunctionDeclaration');
  return { ast, source: chunk.slice(ast.start, ast.end), nodes: nodes(ast) };
};
const assignedMap = (source, name) => {
  const match = source.match(new RegExp(`\\b${name}=\\{([^{}]*)\\}`));
  assert.ok(match, `Native map changed: ${name}`);
  const object = parseAst(`const value={${match[1]}}`).body[0].declarations[0].init;
  return Object.fromEntries(object.properties.filter(item => text(item.value)).map(item => [key(item.key), text(item.value)]));
};
const moduleMap = (source, name) => {
  const initializer = funcAt(source, source.indexOf(`${name}={`));
  const strings = Object.fromEntries(initializer.nodes.filter(node => node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && text(node.right)).map(node => [node.left.name, text(node.right)]));
  const object = initializer.nodes.find(node => node.type === 'AssignmentExpression' && node.left.name === name)?.right;
  assert.ok(object?.type === 'ObjectExpression', `Native CSS module changed: ${name}`);
  return Object.fromEntries(object.properties.map(item => [key(item.key), text(item.value) || strings[item.value.name]]));
};
const compile = (fn, bindings) => new Function(...Object.keys(bindings), `return (${fn.source});`)(...Object.values(bindings));
const classNames = (...values) => values.flat(Infinity).filter(value => typeof value === 'string' && value).join(' ');
const cache = { c: length => Array(length).fill(Symbol.for('react.memo_cache_sentinel')) };
const jsx = { jsx: (tag, props) => typeof tag === 'function' ? tag(props) : ({ tag, props }), jsxs: (tag, props) => jsx.jsx(tag, props), Fragment: '#fragment' };
const owner = (ast, target) => nodes(ast).filter(node => node.type === 'FunctionDeclaration' && node.start <= target.start && node.end >= target.end)
  .sort((left, right) => left.end - left.start - (right.end - right.start))[0];
const aliases = fn => {
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

let cachedNative;
const loadNative = () => {
  if (cachedNative) return cachedNative;
  const asar = require(path.join(process.env.APPDATA, 'npm/node_modules/asar'));
  const entries = asar.listPackage(archive);
  const read = entry => asar.extractFile(archive, entry.replace(/^[/\\]/, '')).toString('utf8');
  const shared = read(entries.find(entry => /webview[\\/]assets[\\/]app-shared-.*\.js$/.test(entry)));
  const initial = read(entries.find(entry => /webview[\\/]assets[\\/]app-initial-.*\.js$/.test(entry)));
  const css = entries.filter(entry => /webview[\\/]assets[\\/]app-(initial|shared|primary)-.*\.css$/.test(entry)).map(read).join('\n');
  const editorEntry = entries.find(entry => /webview[\\/]assets[\\/]editor-[^\\/]+\.js$/.test(entry) && read(entry).includes('visualization.annotationControls.title'));
  assert.ok(editorEntry, 'Native Design controls editor changed; re-audit Popover ownership');
  const editor = read(editorEntry), editorAst = parseAst(editor);
  const editorCss = entries.filter(entry => /webview[\\/]assets[\\/]editor-[^\\/]+\.css$/.test(entry)).map(read).join('\n');
  const popover = funcAt(shared, '"data-slot":`popover-content`');
  const floating = funcAt(shared, '.floatingSurface');
  const member = (fn, name) => fn.nodes.find(node => node.type === 'MemberExpression' && key(node.property) === name && node.object.type === 'Identifier')?.object.name;
  const namedClassCall = (fn, predicate) => fn.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(predicate));
  const popClass = namedClassCall(popover, argument => text(argument).includes('text-default z-50 flex origin-'));
  // The class argument is nested in the !unstyled array, not a top-level string.
  const popClassCall = popClass || popover.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && nodes(node).some(child => text(child).includes('text-default z-50 flex origin-')));
  const contentCall = popover.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'data-slot')) === 'popover-content');
  const zoomCall = popover.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && !node.arguments.length);
  const menuCall = namedClassCall(popover, argument => text(argument) === 'opaque');
  const sizeMap = popover.nodes.filter(node => node.type === 'MemberExpression' && node.computed && node.object.type === 'Identifier')
    .map(node => node.object.name).find(name => new RegExp(`\\b${name}=\\{anchor:`).test(shared));
  assert.ok(popClassCall && contentCall && zoomCall && menuCall && sizeMap, 'Native Popover pure renderer contract changed');
  const menu = funcAt(shared, shared.indexOf(`function ${menuCall.callee.name}(`) + 10);
  const popBindings = {
    [member(popover, 'c')]: cache,
    [member(popover, 'jsx')]: jsx,
    [member(popover, 'useContext')]: { useContext: () => ({ id: undefined }) },
    [popover.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'SequenceExpression' && key(node.callee.expressions.at(-1)?.property) === 'useContext').arguments[0].name]: {},
    [popClassCall.callee.name]: classNames,
    [zoomCall.callee.name]: () => 1,
    [menuCall.callee.name]: compile(menu, {}),
    [sizeMap]: assignedMap(shared, sizeMap),
    [contentCall.arguments[0].name]: props => props.asChild ? ({ tag: props.children.tag, props: { ...props.children.props, ...props,
      role: 'dialog', className: classNames(props.children.props.className, props.className), style: { ...props.children.props.style, ...props.style }, children: props.children.props.children } })
      : ({ tag: 'div', props: { role: 'dialog', ...props } })
  };
  // Tests bypass only the Radix mounting portal. All native class selection,
  // sizing and unstyled/default/menu decisions execute the installed renderer.
  const renderPopover = options => compile(popover, popBindings)({ disablePortal: true, ...options });
  const floatClassCall = floating.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && nodes(node).some(child => child.type === 'MemberExpression' && key(child.property) === 'floatingSurface'));
  const moduleName = member(floating, 'floatingSurface');
  const moduleAnchor = shared.indexOf(`${moduleName}={floatingSurface:`);
  const module = funcAt(shared, moduleAnchor);
  const strings = Object.fromEntries(module.nodes.filter(node => node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && text(node.right)).map(node => [node.left.name, text(node.right)]));
  const mapping = module.nodes.find(node => node.type === 'AssignmentExpression' && node.left.name === moduleName)?.right;
  const floatingClasses = Object.fromEntries(mapping.properties.map(item => [key(item.key), strings[item.value.name]]));
  const renderFloating = compile(floating, { [member(floating, 'c')]: cache, [member(floating, 'jsx')]: jsx,
    [member(floating, 'cloneElement')]: { cloneElement: (child, props) => ({ ...child, props: { ...child.props, ...props } }) },
    [floatClassCall.callee.name]: classNames, [moduleName]: floatingClasses });
  const popAlias = shared.match(new RegExp(`\\b${popover.ast.id.name} as ([\\w$]+)`))?.[1];
  const floatAlias = shared.match(new RegExp(`\\b${floating.ast.id.name} as ([\\w$]+)`))?.[1];
  const imports = editorAst.body.filter(node => node.type === 'ImportDeclaration' && /app-shared-.*\.js$/.test(node.source.value)).flatMap(node => node.specifiers);
  const imported = name => imports.find(specifier => key(specifier.imported) === name)?.local.name;
  const editorPopover = nodes(editorAst).find(node => node.type === 'CallExpression' && node.arguments[0]?.name === imported(popAlias) && prop(node.arguments[1], 'unstyled'));
  assert.ok(editorPopover, 'Native Design controls Popover caller changed');
  const editorFunction = owner(editorAst, editorPopover), editorNodes = nodes(editorFunction), reaches = aliases(editorFunction);
  const innerFloating = editorNodes.find(node => node.type === 'CallExpression' && node.arguments[0]?.name === imported(floatAlias));
  const surfaceCall = editorNodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => argument.type === 'MemberExpression' && key(argument.property) === 'surface'));
  const surfaceClass = editorCss.match(/\.(_surface_[\w]+)\{--radius-token-composer-single-line:/)?.[1];
  assert.ok(innerFloating && surfaceCall && surfaceClass && reaches(prop(innerFloating.arguments[1], 'className'), surfaceCall), 'Native editor inner FloatingSurface ownership changed');
  const editorClasses = [surfaceClass, ...surfaceCall.arguments.map(text).filter(Boolean)].join(' ');
  const toolbar = funcAt(initial, 'pointer-events-auto flex w-fit max-w-full overflow-hidden');
  const toolbarAlias = initial.match(new RegExp(`\\b${toolbar.ast.id.name} as ([\\w$]+)`))?.[1];
  assert.ok(toolbarAlias, 'Native independent toolbar export changed');
  const toolbarBase = toolbar.nodes.map(text).find(value => value === 'pointer-events-auto flex w-fit max-w-full overflow-hidden');
  const toolbarPaint = toolbar.nodes.map(text).find(value => value.includes('min-w-0 flex-wrap items-center rounded-xl bg-surface-elevated-secondary'));
  assert.ok(toolbarBase && toolbarPaint, 'Native independent toolbar carrier changed');
  const aboutEntry = entries.find(entry => /webview[\\/]assets[\\/]about-you-summary-.*\.js$/.test(entry) &&
    parseAst(read(entry)).body.some(node => node.type === 'ImportDeclaration' && /app-initial-.*\.js$/.test(node.source.value) &&
      node.specifiers.some(specifier => key(specifier.imported) === toolbarAlias)));
  assert.ok(aboutEntry, 'Native independent toolbar consumer changed');
  const aboutAst = parseAst(read(aboutEntry));
  const controls = read(entries.find(entry => /webview[\\/]assets[\\/]design-editor-state-.*\.js$/.test(entry)));
  const controlAst = parseAst(controls);
  const selectClass = nodes(controlAst).find(node => node.type === 'CallExpression' && node.arguments.some(argument => text(argument).includes('cursor-interaction items-center gap-2 overflow-hidden px-3 text-start')))?.arguments.map(text).filter(Boolean).join(' ');
  const inputClass = nodes(controlAst).find(node => node.type === 'CallExpression' && node.arguments.some(argument => text(argument).startsWith('min-w-0 appearance-none border-0 bg-transparent')))?.arguments.map(text).filter(Boolean).join(' ');
  const switchFn = funcAt(shared, 'thumbClassName:');
  const switchVisual = switchFn.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'checked') && prop(node.arguments[1], 'thumbClassName'))?.arguments[0].name;
  const switchTrack = funcAt(shared, shared.indexOf(`function ${switchVisual}(`) + 10);
  const switchMaps = [...new Set(switchTrack.nodes.filter(node => node.type === 'MemberExpression' && node.computed && node.object.type === 'Identifier').map(node => node.object.name))]
    .filter(name => new RegExp(`\\b${name}=\\{default:`).test(shared));
  const switchClass = switchTrack.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => text(argument).startsWith('relative inline-flex shrink-0')))?.callee.name;
  const renderSwitchTrack = compile(switchTrack, { [member(switchTrack, 'c')]: cache, [member(switchTrack, 'jsx')]: jsx, [switchClass]: classNames,
    ...Object.fromEntries(switchMaps.map(name => [name, assignedMap(shared, name)])) });
  const renderSwitch = compile(switchFn, { [member(switchFn, 'c')]: cache, [member(switchFn, 'jsx')]: jsx,
    [switchFn.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => text(argument).startsWith('inline-flex items-center text-sm')))?.callee.name]: classNames,
    [switchVisual]: renderSwitchTrack });
  assert.ok(inputClass && selectClass, 'Native design input/select class contract changed');
  const avatarEntry = entries.find(entry => /webview[\\/]assets[\\/]avatar-overlay-native-page-.*\.js$/.test(entry));
  const avatarSource = read(avatarEntry), avatarAst = parseAst(avatarSource);
  const avatarMaterial = funcAt(initial, '"data-avatar-overlay-material-variant":');
  const avatarModuleName = member(avatarMaterial, 'Material');
  const avatarClassCall = avatarMaterial.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => argument.type === 'MemberExpression' && key(argument.property) === 'Material'));
  const renderAvatarMaterial = compile(avatarMaterial, { [member(avatarMaterial, 'c')]: cache, [member(avatarMaterial, 'jsx')]: jsx,
    [avatarClassCall.callee.name]: classNames, [avatarModuleName]: moduleMap(initial, avatarModuleName) });
  const avatarReaction = funcAt(avatarSource, 'floodColor:`var(--color-surface)`');
  const reactionCall = avatarReaction.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'variant')) === 'reaction-picker');
  assert.ok(reactionCall, 'Native reaction picker material call changed');
  const renderAvatarReaction = compile(avatarReaction, { [member(avatarReaction, 'c')]: cache, [member(avatarReaction, 'jsx')]: jsx,
    [member(avatarReaction, 'useId')]: { useId: () => 'native-reaction-filter' }, [reactionCall.arguments[0].name]: renderAvatarMaterial });
  const checkoutEntry = entries.find(entry => /webview[\\/]assets[\\/]checkout-page-.*\.js$/.test(entry) && read(entry).includes('chatgpt.inline_credit_checkout.payment.title'));
  const checkoutSource = read(checkoutEntry), checkoutAst = parseAst(checkoutSource);
  const checkoutCss = entries.filter(entry => /webview[\\/]assets[\\/]checkout-page-.*\.css$/.test(entry)).map(read).join('\n');
  const shellEntry = entries.find(entry => /webview[\\/]assets[\\/]shell-.*\.js$/.test(entry) && read(entry).includes('data-checkout-presentation'));
  const shellSource = read(shellEntry), shellAst = parseAst(shellSource);
  const checkoutShell = funcAt(shellSource, '"data-checkout-presentation":');
  const checkoutModuleName = member(checkoutShell, 'root');
  const checkoutModuleImport = shellAst.body.filter(node => node.type === 'ImportDeclaration' && /app-initial-.*\.js$/.test(node.source.value)).flatMap(node => node.specifiers)
    .find(specifier => specifier.local.name === checkoutModuleName)?.imported.name;
  const checkoutModuleExport = initial.match(new RegExp(`([\\w$]+) as ${checkoutModuleImport}[,}]`))?.[1];
  const checkoutShellClassCall = checkoutShell.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => argument.type === 'MemberExpression' && key(argument.property) === 'root'));
  const renderCheckoutShell = compile(checkoutShell, { [member(checkoutShell, 'c')]: cache, [member(checkoutShell, 'jsx')]: jsx,
    [checkoutShellClassCall.callee.name]: classNames, [checkoutModuleName]: moduleMap(initial, checkoutModuleExport) });
  const checkout = funcAt(checkoutSource, 'chatgpt.inline_credit_checkout.payment.title');
  const checkoutRootCall = checkout.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'presentation')) === 'inline');
  const checkoutPaintCall = checkout.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => argument.type === 'MemberExpression' && key(argument.property) === 'surface'));
  const checkoutPaintModule = checkoutPaintCall.arguments.find(argument => argument.type === 'MemberExpression' && key(argument.property) === 'surface').object.name;
  const checkoutHeading = checkout.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'id')) === 'chatgpt.inline_credit_checkout.payment.title');
  assert.ok(checkoutRootCall && checkoutPaintCall && checkoutHeading, 'Native inline checkout painted root changed');
  const renderCheckout = compile(checkout, { [member(checkout, 'c')]: cache, [member(checkout, 'jsx')]: jsx,
    [member(checkout, 'useRef')]: { useRef: () => ({ current: null }), useState: () => [undefined, () => {}], useEffect: () => {} },
    [checkoutPaintCall.callee.name]: classNames, [checkoutPaintModule]: moduleMap(checkoutSource, checkoutPaintModule),
    [checkoutRootCall.arguments[0].name]: renderCheckoutShell, [checkoutHeading.arguments[0].name]: props => ({ tag: 'span', props: { children: props.defaultMessage } }) });
  const dialogEntry = entries.find(entry => /webview[\\/]assets[\\/]dialog-.*\.js$/.test(entry) && read(entry).includes('checkout.inline.label'));
  const checkoutDialogAst = parseAst(read(dialogEntry));
  const checkoutPageExport = checkoutSource.match(new RegExp(`\\b${checkout.ast.id.name} as ([\\w$]+)`))?.[1];
  cachedNative = { css: `${css}\n${editorCss}\n${checkoutCss}`, renderPopover, renderFloating, renderSwitch, editorPopover, editorFunction, innerFloating, reaches,
    editorClasses, toolbarClasses: `${toolbarBase} ${toolbarPaint}`, inputClass, selectClass, popAlias, floatAlias,
    avatarAst, avatarReaction, avatarMaterial, renderAvatarReaction, renderAvatarMaterial, checkoutDialogAst, checkoutAst, checkoutRootCall, checkoutShell, checkoutPageExport, renderCheckout,
    aboutAst, toolbar, toolbarAlias, checkoutSecondary: checkoutCss.match(/\.(_secondary_[\w]+)\{background:var\(--bg-tertiary\)/)?.[1],
    editorHeader: editorNodes.map(text).find(value => value.startsWith('flex h-toolbar shrink-0 cursor-grab')),
    editorHeading: editorNodes.map(text).find(value => value.startsWith('flex h-token-button-composer min-w-0 flex-1')) };
  return cachedNative;
};

test('native Design controls keeps its unstyled Popover shell around one FloatingSurface', { skip }, () => {
  const native = loadNative();
  const outerProps = native.editorPopover.arguments[1];
  assert.equal(prop(outerProps, 'unstyled')?.operator, '!');
  assert.equal(prop(outerProps, 'unstyled')?.argument.value, 0);
  assert.ok(prop(outerProps, 'children')?.elements.some(child => native.reaches(child, native.innerFloating)), 'The independent floating owner must remain a direct Popover child');
  const openParameter = nodes(native.editorFunction).find(node => node.type === 'ObjectPattern' && node.properties.some(item => key(item.key) === 'isOpen'))?.properties.find(item => key(item.key) === 'isOpen')?.value;
  assert.ok(nodes(native.editorFunction).some(node => node.type === 'CallExpression' && prop(node.arguments[1], 'open')?.name === openParameter?.name), 'Native Design controls open state changed');
  const shell = native.renderPopover({ unstyled: true, className: text(prop(outerProps, 'className')) });
  assert.equal(shell.props['data-slot'], 'popover-content');
  assert.equal(shell.props.role, 'dialog');
  assert.equal(shell.props.className, text(prop(outerProps, 'className')));
  assert.ok(!/(?:^|\s)bg-surface/.test(shell.props.className), 'Native editor shell must remain transparent');
  const inner = native.renderFloating({ className: native.editorClasses });
  assert.match(inner.props.className, /(?:^|\s)bg-surface-elevated-secondary(?:\s|$)/);
  assert.match(inner.props.className, /_floatingSurface_/);
  for (const options of [{}, { opaque: false }, { variant: 'comment' }, { variant: 'menu' }]) {
    assert.match(native.renderPopover(options).props.className, /(?:^|\s)bg-surface-elevated-secondary(?:\/90)?(?:\s|$)/);
  }
});

test('native independent toolbar, avatar material and asChild checkout preserve their actual paint ownership', { skip }, () => {
  const native = loadNative();
  const imported = (ast, pattern, exported) => ast.body.filter(node => node.type === 'ImportDeclaration' && pattern.test(node.source.value))
    .flatMap(node => node.specifiers).find(specifier => key(specifier.imported) === exported)?.local.name;
  const direct = (parent, child, fn) => {
    const children = prop(parent.arguments[1], 'children'), reaches = aliases(fn);
    return children?.type === 'ArrayExpression' ? children.elements.some(item => reaches(item, child)) : reaches(children, child);
  };
  const toolbarImport = imported(native.aboutAst, /app-initial-.*\.js$/, native.toolbarAlias);
  const toolbarCall = nodes(native.aboutAst).find(node => node.type === 'CallExpression' && node.arguments[0]?.name === toolbarImport);
  const aboutPopoverImport = imported(native.aboutAst, /app-shared-.*\.js$/, native.popAlias);
  assert.ok(toolbarCall && nodes(native.aboutAst).some(node => node.type === 'CallExpression' && node.arguments[0]?.name === aboutPopoverImport &&
    prop(node.arguments[1], 'unstyled') && direct(node, toolbarCall, owner(native.aboutAst, node))), 'Native self-painted toolbar must remain a direct child of an unstyled Popover');
  const toolbarRoot = native.toolbar.nodes.find(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'div' && text(prop(node.arguments[1], 'role')) === 'presentation');
  assert.ok(toolbarRoot, 'Native toolbar material must remain its actual block root');
  const avatarImport = imported(native.avatarAst, /app-shared-.*\.js$/, native.popAlias);
  const reactionUses = nodes(native.avatarAst).filter(node => node.type === 'CallExpression' && node.arguments[0]?.name === native.avatarReaction.ast.id.name);
  assert.ok(reactionUses.length, 'Native reaction picker consumer changed');
  const avatarPopover = nodes(native.avatarAst).find(node => node.type === 'CallExpression' && node.arguments[0]?.name === avatarImport && prop(node.arguments[1], 'unstyled'));
  const avatarFn = owner(native.avatarAst, avatarPopover), avatarAliases = aliases(avatarFn);
  const reactionBranch = nodes(avatarFn).find(node => node.type === 'ConditionalExpression' && reactionUses.includes(node.consequent));
  assert.ok(reactionBranch && avatarAliases(prop(avatarPopover.arguments[1], 'children'), reactionBranch), 'Native reaction material must remain directly in the transparent Popover branch');
  const avatar = native.renderAvatarReaction({ children: 'Reaction choices' });
  assert.equal(avatar.props['data-avatar-overlay-material'], 'css');
  assert.equal(avatar.props['data-avatar-overlay-material-variant'], 'reaction-picker');
  assert.match(avatar.props.style.backdropFilter, /^url\(#/);
  const checkoutImport = imported(native.checkoutDialogAst, /checkout-page-.*\.js$/, native.checkoutPageExport);
  const checkoutCall = nodes(native.checkoutDialogAst).find(node => node.type === 'CallExpression' && node.arguments[0]?.name === checkoutImport);
  const checkoutPopoverImport = imported(native.checkoutDialogAst, /app-shared-.*\.js$/, native.popAlias);
  const checkoutPopover = nodes(native.checkoutDialogAst).find(node => node.type === 'CallExpression' && node.arguments[0]?.name === checkoutPopoverImport && prop(node.arguments[1], 'asChild'));
  assert.ok(checkoutCall && checkoutPopover && prop(checkoutPopover.arguments[1], 'unstyled') &&
    direct(checkoutPopover, checkoutCall, owner(native.checkoutDialogAst, checkoutPopover)), 'Native inline checkout must remain the merged asChild surface');
  const checkout = native.renderCheckout({ isDarkMode: true, children: 'Checkout controls' });
  assert.equal(checkout.props['data-checkout-presentation'], 'inline');
  assert.equal(checkout.props['data-checkout-theme'], 'dark');
  assert.ok(!/(?:^|\s)bg-surface/.test(checkout.props.className), 'Inline checkout must exercise its actual CSS module material');
});

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const html = tree => {
  if (tree == null || tree === false) return '';
  if (typeof tree === 'string') return escape(tree);
  if (Array.isArray(tree)) return tree.map(html).join('');
  const { tag, props } = tree;
  if (tag === '#fragment') return html(props.children);
  const attributes = Object.entries(props).filter(([name, value]) => !['children', 'style', 'ref'].includes(name) && !name.startsWith('on') && value !== undefined && value !== false)
    .map(([name, value]) => `${name === 'className' ? 'class' : ['floodColor', 'floodOpacity', 'colorInterpolationFilters'].includes(name) ? name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`) : name}="${escape(value === true ? 'true' : value)}"`).join(' ');
  const style = props.style ? Object.entries(props.style).filter(([, value]) => value !== undefined).map(([name, value]) => `${name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}:${value}`).join(';') : '';
  return `<${tag} ${attributes}${style ? ` style="${escape(style)}"` : ''}>${html(props.children)}</${tag}>`;
};

test('Popover shells stay transparent while actual native carriers paint once and keep controls and external frames unchanged', { skip }, async () => {
  const native = loadNative();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    const controlTree = () => ({ tag: 'div', props: { className: 'flex flex-col gap-2 p-4', children: [
      { tag: 'input', props: { 'data-control': 'input', 'aria-label': 'Color', className: native.inputClass, value: '#abcdef' } },
      { tag: 'button', props: { 'data-control': 'select', 'aria-label': 'Variant', className: native.selectClass, 'aria-haspopup': 'menu', children: 'Default' } },
      native.renderSwitch({ id: 'native-toggle', 'data-control': 'switch', ariaLabel: 'Enabled', checked: true, onChange: () => {} })
    ] } });
    const inner = native.renderFloating({ id: 'design-paint', className: native.editorClasses, children: controlTree() });
    const design = native.renderPopover({ id: 'design-shell', unstyled: true, className: text(prop(native.editorPopover.arguments[1], 'className')), children: inner });
    const pop = (id, options = {}, children) => native.renderPopover({ id, ...options, children });
    const reaction = native.renderAvatarReaction({ children: { tag: 'button', props: { id: 'avatar-action', className: 'bg-primary-soft rounded-md px-2', children: 'Reaction' } } });
    reaction.props.id = 'avatar-paint';
    const checkoutControls = () => ({ tag: 'div', props: { children: [
      { tag: 'input', props: { 'data-checkout-control': 'input', 'aria-label': 'Credit amount', className: native.inputClass, value: '20' } },
      { tag: 'button', props: { 'data-checkout-control': 'button', className: native.checkoutSecondary, disabled: true, children: 'Continue' } }
    ] } });
    const checkout = (expanded, isDarkMode) => pop('checkout-inline', { asChild: true, unstyled: true, className: 'z-50' }, native.renderCheckout({ expanded, isDarkMode, children: checkoutControls() }));
    const cases = [design,
      ...[{}, { opaque: false }, { variant: 'comment' }, { variant: 'menu' }].map((options, index) => pop(`styled-${index}`, options, { tag: 'div', props: { id: `styled-child-${index}`, className: 'bg-surface-elevated-secondary', children: 'Child must not add glass' } })),
      pop('custom-own', { unstyled: true, className: 'rounded-xl bg-surface-elevated-secondary/90' }, 'Self painted caller'),
      pop('canvas-own', { unstyled: true, className: 'rounded-xl bg-surface-canvas' }, 'Canvas caller'),
      pop('as-child-form', { asChild: true, unstyled: true }, { tag: 'form', props: { className: 'rounded-xl bg-surface', children: 'Form caller' } }),
      ...['div', 'section', 'form', 'aside', 'nav'].map(tag => pop(`child-${tag}`, { unstyled: true }, { tag, props: { id: `carrier-${tag}`, className: native.toolbarClasses, children: [
        { tag: 'h2', props: { id: `heading-${tag}`, className: 'bg-surface-elevated-secondary', children: 'Nested native heading' } }, 'Native independent carrier'
      ] } })),
      pop('button-shell', { unstyled: true }, { tag: 'button', props: { id: 'button-carrier', className: native.toolbarClasses, children: 'Interactive button' } }),
      ...['hover:bg-surface-elevated-secondary', 'after:bg-surface-elevated-secondary', 'bg-transparent', 'bg-transparent hover:bg-surface-elevated-secondary'].map((className, index) => pop(`negative-${index}`, { unstyled: true, className }, 'Transparent native shell')),
      pop('coachmark', { unstyled: true, className: 'bg-coachmark' }, 'Intentional native coachmark'),
      pop('avatar-shell', { unstyled: true }, reaction),
      native.renderAvatarMaterial({ id: 'avatar-native', variant: 'reaction-picker', children: 'Independent native material', style: { backdropFilter: 'url(#native-reaction-filter)' } }),
      checkout(false, true), native.renderCheckout({ id: 'checkout-native', expanded: false, isDarkMode: true, children: checkoutControls() })
    ];
    await page.setContent(`<html data-theme="dark"><head><style>${native.css}</style><style>body{margin:0;padding:12px}#fixtures{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:start}#design-shell{height:var(--test-panel-height,240px);width:var(--test-panel-width,368px)}iframe{width:180px;height:65px}#as-child-form{display:block}</style></head><body><div id="fixtures">${cases.map(html).join('')}</div><iframe title="External control" srcdoc="<style>body{background:rgb(15,25,35);color:rgb(230,240,250);margin:0}input{background:rgb(40,50,60);border-radius:9px;color:white}</style><input aria-label='External' value='Frame'></input>"></iframe></body></html>`);
    await page.addStyleTag({ content: theme });
    const read = () => page.locator('[id],[data-control],[data-control] *,[data-checkout-control]').evaluateAll(elements => Object.fromEntries(elements.map((element, index) => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      return [element.id || `control-${index}`, { geometry: [rect.x, rect.y, rect.width, rect.height, style.position, style.padding, style.margin, style.borderWidth, style.borderRadius, style.font, style.opacity],
        paint: [style.backgroundColor, style.backgroundImage, style.boxShadow, style.backdropFilter, style.color], checked: element.getAttribute('aria-checked'), disabled: element.disabled, value: element.value,
        checkoutTokens: ['--checkout-bg-primary', '--checkout-text-primary', '--checkout-border-default'].map(name => style.getPropertyValue(name).trim()) }];
    })));
    const transparent = ['design-shell', 'button-shell', 'avatar-shell', ...['div', 'section', 'form', 'aside', 'nav'].map(tag => `child-${tag}`), ...[0, 1, 2, 3].map(index => `negative-${index}`)];
    const painted = ['design-paint', 'custom-own', 'canvas-own', 'as-child-form', 'checkout-inline', ...[0, 1, 2, 3].map(index => `styled-${index}`), ...['div', 'section', 'form', 'aside', 'nav'].map(tag => `carrier-${tag}`)];
    for (const mode of ['dark', 'light']) for (const dimensions of [[368, 240], [470, 360]]) {
      const label = `${mode}/${dimensions.join('x')}`;
      await page.evaluate(({ mode, dimensions }) => { const root = document.documentElement; root.classList.remove('forge-ink-mountain'); Object.assign(root.dataset, { theme: mode, forgeNativeTheme: mode }); root.style.setProperty('--test-panel-width', `${dimensions[0]}px`); root.style.setProperty('--test-panel-height', `${dimensions[1]}px`); }, { mode, dimensions });
      await page.locator('#checkout-inline').evaluate((element, replacement) => { element.outerHTML = replacement; }, html(checkout(dimensions[0] > 400, mode === 'dark')));
      await page.locator('#checkout-native').evaluate((element, replacement) => { element.outerHTML = replacement; }, html(native.renderCheckout({ id: 'checkout-native', expanded: dimensions[0] > 400, isDarkMode: mode === 'dark', children: checkoutControls() })));
      await page.locator('[data-avatar-overlay-material]').evaluateAll((elements, mode) => elements.forEach(element => element.dataset.theme = mode), mode);
      await page.locator('#checkout-inline,#checkout-native').evaluateAll(elements => Promise.allSettled(elements.flatMap(element => element.getAnimations({ subtree: true })).map(animation => animation.finished)));
      const before = await read();
      const frameBefore = await page.frameLocator('iframe').locator('body,input').evaluateAll(elements => elements.map(element => { const style = getComputedStyle(element); return [style.backgroundColor, style.color, style.borderRadius, element.value]; }));
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      const after = await read();
      for (const id of Object.keys(before)) assert.deepEqual(after[id].geometry, before[id].geometry, `${label}: ${id} retains native geometry and rounded corners`);
      for (const id of transparent) assert.deepEqual(after[id].paint.slice(0, 4), ['rgba(0, 0, 0, 0)', 'none', 'none', 'none'], `${label}: ${id} must remain a transparent positioning shell`);
      for (const id of painted) { assert.notEqual(after[id].paint[0], 'rgba(0, 0, 0, 0)', `${label}: ${id} keeps readable fill`); assert.match(after[id].paint[3], /blur\(/, `${label}: ${id} owns the only glass layer`); }
      for (const id of Object.keys(before).filter(id => id.startsWith('control-') || ['native-toggle', 'avatar-action', 'avatar-native', 'checkout-native', 'coachmark', 'button-carrier'].includes(id) || id.startsWith('styled-child-') || id.startsWith('heading-'))) assert.deepEqual(after[id], before[id], `${label}: ${id} remains native`);
      assert.notEqual(after['avatar-paint'].paint[0], before['avatar-paint'].paint[0], `${label}: reaction material adopts the theme fill`);
      assert.deepEqual(after['avatar-paint'].paint.slice(1), before['avatar-paint'].paint.slice(1), `${label}: avatar keeps native SVG backdrop, border elevation and foreground`);
      assert.match(after['avatar-paint'].paint[3], /^url\(/);
      assert.deepEqual(after['checkout-inline'].checkoutTokens, before['checkout-inline'].checkoutTokens, `${label}: checkout controls keep their native color tokens`);
      assert.equal(await page.locator('#design-shell').evaluate(element => [...element.querySelectorAll('*')].filter(child => getComputedStyle(child).backdropFilter !== 'none').length), 1, `${label}: design controls paints one glass surface`);
      assert.deepEqual(await page.frameLocator('iframe').locator('body,input').evaluateAll(elements => elements.map(element => { const style = getComputedStyle(element); return [style.backgroundColor, style.color, style.borderRadius, element.value]; })), frameBefore, `${label}: external frame is isolated`);
    }
    await page.getByRole('textbox', { name: 'Color', exact: true }).fill('#123456');
    assert.equal(await page.getByRole('textbox', { name: 'Color', exact: true }).inputValue(), '#123456');
    await page.getByRole('button', { name: 'Variant', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Variant', exact: true }).evaluate(element => element === document.activeElement), true);
    await page.getByRole('switch', { name: 'Enabled', exact: true }).click();
    assert.equal(await page.getByRole('switch', { name: 'Enabled', exact: true }).evaluate(element => element === document.activeElement), true);
    // The real caller has an open state. This fixture checks remount stability
    // only; it does not claim the native visualization business flow was run.
    await page.locator('#design-shell').evaluate(element => element.remove());
    assert.equal(await page.locator('#design-shell').count(), 0);
    await page.locator('#fixtures').evaluate((element, content) => element.insertAdjacentHTML('afterbegin', content), html(design));
    assert.equal(await page.locator('#design-shell').evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
    if (process.env.CODEX_WRITE_POPOVER_PREVIEWS === '1') {
      const preview = await browser.newPage({ viewport: { width: 440, height: 410 } });
      try {
        for (const mode of ['dark', 'light']) {
          const header = { tag: 'div', props: { className: native.editorHeader, children: { tag: 'h2', props: { className: native.editorHeading, children: '设计控件 · 组件夹具' } } } };
          const panel = native.renderPopover({ id: 'design-preview', unstyled: true, className: text(prop(native.editorPopover.arguments[1], 'className')),
            children: native.renderFloating({ className: native.editorClasses, children: [header, controlTree()] }) });
          await preview.setContent(`<html class="forge-ink-mountain" data-theme="${mode}" data-forge-native-theme="${mode}"><head><meta charset="utf-8"><style>${native.css}\n${theme}</style><style>body{margin:0;padding:32px;background:${mode === 'dark' ? 'linear-gradient(145deg,#132333,#506775)' : 'linear-gradient(145deg,#dce8ef,#a9b9c5)'};min-height:410px}#design-preview{width:368px;height:320px}#design-preview input{max-width:100%}</style></head><body>${html(panel)}</body></html>`);
          // Show only the actual renderer's rounded boundary, with an outer
          // backdrop margin. This is a material fixture, not a business UI mock.
          const bounds = await preview.locator('#design-preview').boundingBox();
          await preview.screenshot({ path: new URL(`../docs/previews/${mode}-design-controls-fixture.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1'),
            clip: { x: bounds.x + bounds.width - 120, y: bounds.y - 16, width: 136, height: 116 } });
        }
      } finally { await preview.close(); }
    }
  } finally { await browser.close(); }
});
