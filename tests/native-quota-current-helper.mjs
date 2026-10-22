import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseAst } from 'rollup/parseAst';

const provenance = JSON.parse(fs.readFileSync(new URL('../docs/native-asar-provenance.json', import.meta.url), 'utf8'));
export const quotaPackageVersion = provenance.packageVersion;
export const quotaArchive = process.env.CODEX_LOCAL_ASAR || path.join(process.env.ProgramFiles || '', 'WindowsApps',
  provenance.packageDirectoryName, provenance.asarRelativePath);
export const quotaNativeSkip = !fs.existsSync(quotaArchive) && 'Requires the audited quota-recovery ASAR';
const require = createRequire(import.meta.url);
export const key = node => node?.name ?? node?.value;
export const text = node => node?.type === 'TemplateLiteral' ? node.quasis.map(part => part.value.cooked).join(' ')
  : node?.type === 'Literal' ? String(node.value) : '';
export const prop = (node, name) => node?.type === 'ObjectExpression'
  ? node.properties.find(item => item.type === 'Property' && key(item.key) === name)?.value : undefined;
export const nodes = tree => {
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
const astCache = new Map();
const functionAt = (source, anchor) => {
  const at = typeof anchor === 'number' ? anchor : source.indexOf(anchor);
  assert.ok(at >= 0, `Quota native anchor changed: ${anchor}`);
  if (!astCache.has(source)) astCache.set(source, parseAst(source));
  const ast = astCache.get(source).body.find(node => node.type === 'FunctionDeclaration' && node.start <= at && node.end > at);
  assert.ok(ast, `Quota native function changed: ${anchor}`);
  return { ast, source: source.slice(ast.start, ast.end), nodes: nodes(ast) };
};
const member = (fn, name) => fn.nodes.find(node => node.type === 'MemberExpression' && key(node.property) === name && node.object.type === 'Identifier')?.object.name;
const compile = (fn, bindings) => new Function(...Object.keys(bindings), `return (${fn.source});`)(...Object.values(bindings));
const classNames = (...values) => values.flat(Infinity).filter(value => typeof value === 'string' && value).join(' ');
const cache = { c: length => Array(length).fill(Symbol.for('react.memo_cache_sentinel')) };
const jsx = { jsx: (tag, props) => typeof tag === 'function' ? tag(props) : ({ tag, props }),
  jsxs: (tag, props) => jsx.jsx(tag, props), Fragment: '#fragment' };
const nativeMap = (source, name) => {
  if (!astCache.has(source)) astCache.set(source, parseAst(source));
  const content = nodes(astCache.get(source));
  const strings = Object.fromEntries(content.filter(node => node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && text(node.right))
    .map(node => [node.left.name, text(node.right)]));
  const object = content.find(node => node.type === 'AssignmentExpression' && node.left.name === name && node.right.type === 'ObjectExpression')?.right;
  assert.equal(object?.type, 'ObjectExpression', `Native quota/button map changed: ${name}`);
  return Object.fromEntries(object.properties.map(item => [key(item.key), text(item.value) || strings[item.value.name]]));
};

let cached;
export const loadQuotaNative = () => {
  if (cached) return cached;
  const asar = require(path.join(process.env.APPDATA, 'npm/node_modules/asar'));
  const entries = asar.listPackage(quotaArchive);
  const read = entry => asar.extractFile(quotaArchive, entry.replace(/^[/\\]/, '')).toString('utf8');
  const entry = kind => entries.find(item => new RegExp(`webview[\\\\/]assets[\\\\/]app-${kind}-.*\\.js$`).test(item));
  const sharedEntry = entry('shared'), initialEntry = entry('initial'), primaryEntry = entry('primary');
  const shared = read(sharedEntry), initial = read(initialEntry), primary = read(primaryEntry);
  const index = read(entries.find(item => /webview[\\/]index\.html$/.test(item)));
  const layerOrder = index.match(/@layer\s+theme,\s*base,\s*components,\s*utilities;/)?.[0];
  assert.ok(layerOrder, 'Native index CSS layer prelude changed');
  const cssEntries = ['shared', 'initial', 'primary'].map(kind => entries.find(item => new RegExp(`webview[\\\\/]assets[\\\\/]app-${kind}-.*\\.css$`).test(item)));
  const css = `${layerOrder}\n${cssEntries.map(read).join('\n')}`;
  const moduleMatch = [...shared.matchAll(/([\w$]+)=\{banner:([\w$]+),description:([\w$]+)\}/g)]
    .find(match => functionAt(shared, match.index).nodes.some(node => text(node).startsWith('_banner_')));
  assert.ok(moduleMatch, 'Native recovery-banner CSS module changed');
  const classes = nativeMap(shared, moduleMatch[1]);
  const banner = functionAt(shared, shared.indexOf(`${moduleMatch[1]}.banner`, moduleMatch.index));
  const classCall = banner.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' &&
    node.arguments.some(argument => argument.type === 'MemberExpression' && key(argument.property) === 'banner'));
  const aside = banner.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'role')) === 'status');
  const placementCall = banner.nodes.find(node => node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression' &&
    node.arguments[0]?.type === 'Identifier' && prop(node.arguments[1], 'children')?.type === 'CallExpression' &&
    prop(node.arguments[1], 'children').arguments[0]?.type === 'MemberExpression');
  const contextCall = banner.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'value')) === 'recovery');
  assert.ok(classCall && aside && placementCall && contextCall, 'Native quota recovery surface topology changed');
  const placement = functionAt(shared, shared.indexOf(`function ${placementCall.arguments[0].name}(`) + 10);
  // Only pure presentation executes: portal mounting and animation ownership
  // are bypassed. No account, reset, upgrade, network or purchase code runs.
  const renderBanner = compile(banner, { [member(banner, 'c')]: cache, [member(banner, 'jsx')]: jsx,
    [classCall.callee.name]: classNames, [moduleMatch[1]]: classes,
    [aside.arguments[0].object.name]: { [key(aside.arguments[0].property)]: 'aside' },
    [placementCall.arguments[0].name]: props => props.children,
    [contextCall.arguments[0].name]: props => props.children });

  const button = functionAt(shared, 'no-drag cursor-interaction items-center select-none disabled:cursor-default');
  const mapNames = [...new Set(button.nodes.filter(node => node.type === 'MemberExpression' && node.computed && node.object.type === 'Identifier' &&
    node.property.type !== 'Literal').map(node => node.object.name))].filter(name => shared.includes(`${name}={`));
  const buttonClass = button.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' &&
    node.arguments.some(argument => text(argument).startsWith('no-drag cursor-interaction')));
  const loadingIcon = button.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'className')?.type === 'Identifier' &&
    node.arguments[0]?.type === 'Identifier');
  assert.ok(buttonClass && loadingIcon && mapNames.length >= 4, 'Native quota action button contract changed');
  const renderButton = compile(button, { [member(button, 'c')]: cache, [member(button, 'jsx')]: jsx,
    [buttonClass.callee.name]: classNames, [loadingIcon.arguments[0].name]: () => null,
    ...Object.fromEntries(mapNames.map(name => [name, nativeMap(shared, name)])) });
  const notice = functionAt(shared, shared.indexOf(`jsx)(${banner.ast.id.name},{title:`));

  const composerRoot = functionAt(initial, '"data-composer-surface-variant":');
  const composerBody = functionAt(initial, '"data-composer-body":');
  const composerMap = composerRoot.nodes.find(node => node.type === 'MemberExpression' && key(node.property) === 'ComposerLayoutRoot').object.name;
  const composerClasses = nativeMap(initial, composerMap);
  const contexts = composerRoot.nodes.filter(node => node.type === 'CallExpression' && node.callee.type === 'SequenceExpression' &&
    key(node.callee.expressions.at(-1)?.property) === 'useContext').map(node => node.arguments[0].name);
  assert.equal(contexts.length, 3, 'Native composer root contexts changed');
  const noop = () => {};
  const rootContext = { animateLayout: false, expansion: null, homeMode: undefined, isHome: false };
  let fixtureIsHome = false;
  const contextValues = Object.fromEntries([[contexts[0], 'default'], [contexts[1], { hasComposerSurface: false, shouldAnimate: false }], [contexts[2], rootContext]]);
  const composerBindings = fn => {
    const bindings = { [member(fn, 'c')]: cache, [member(fn, 'jsx')]: jsx,
      [member(fn, 'useContext')]: { useContext: value => value, useRef: value => ({ current: value }), useLayoutEffect: noop, useEffect: noop, useEffectEvent: value => value },
      [composerMap]: composerClasses, ...contextValues };
    for (const node of fn.nodes) {
      if (node.type === 'MemberExpression' && key(node.property) === 'div') bindings[node.object.name] = { div: 'div' };
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => text(argument).includes('var(--composer-surface-border-radius)'))) bindings[node.callee.name] = () => '28px';
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => argument.type === 'MemberExpression' && argument.object.name === composerMap)) bindings[node.callee.name] = classNames;
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.length === 0) bindings[node.callee.name] = () => true;
    }
    // Context provider and event/ref functions are transport-only boundaries.
    bindings[contexts[2]] = Object.assign(props => props.children, rootContext);
    bindings[member(fn, 'useContext')].useContext = value => typeof value === 'function' ? { ...rootContext, isHome: fixtureIsHome } : value;
    for (const node of fn.nodes) {
      if (node.type === 'Property' && ['onMouseDown'].includes(key(node.key)) && node.value.type === 'Identifier') bindings[node.value.name] = noop;
    }
    return bindings;
  };
  const bodyBindings = composerBindings(composerBody);
  const mergedRef = composerBody.nodes.filter(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.length === 2 && node.arguments.every(argument => argument.type === 'Identifier')).at(-1);
  assert.ok(mergedRef, 'Native composer body merged-ref boundary changed');
  bodyBindings[mergedRef.callee.name] = noop;
  const renderComposerRoot = compile(composerRoot, composerBindings(composerRoot));
  const renderComposerBody = compile(composerBody, bodyBindings);
  const initialAst = astCache.get(initial);
  const exported = name => initialAst.body.filter(node => node.type === 'ExportNamedDeclaration').flatMap(node => node.specifiers)
    .find(node => key(node.exported) === name)?.local.name;
  const exportedRenderer = exported('hr');
  assert.ok(exportedRenderer, 'Native public composer renderer export changed');
  const layoutRenderer = functionAt(initial, initial.indexOf(`function ${exportedRenderer}(`) + 10);
  const componentModule = layoutRenderer.nodes.find(node => node.type === 'MemberExpression' && key(node.property) === 'Body').object.name;
  const moduleAssignment = nodes(initialAst).find(node => node.type === 'AssignmentExpression' && node.left.name === componentModule && node.right.type === 'CallExpression' &&
    node.right.callee.type === 'MemberExpression' && key(node.right.callee.property) === 'assign');
  assert.ok(moduleAssignment, 'Native public composer primitive registry changed');
  const primitiveNames = Object.fromEntries(moduleAssignment.right.arguments[1].properties.map(node => [key(node.key), node.value.name]));
  const primitiveFunctions = Object.fromEntries(Object.entries(primitiveNames).map(([name, fn]) => [name, functionAt(initial, initial.indexOf(`function ${fn}(`) + 10)]));
  const primitiveRenderers = Object.assign(props => renderComposerRoot(props), { Body: renderComposerBody });
  const primitiveCompile = (name, additions = {}) => {
    const fn = primitiveFunctions[name], bindings = composerBindings(fn);
    for (const node of fn.nodes) {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.length === 2 && node.arguments.every(argument => argument.type === 'Identifier')) bindings[node.callee.name] = noop;
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => text(argument).startsWith('(width <'))) bindings[node.callee.name] = () => false;
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => text(argument).startsWith('flex '))) bindings[node.callee.name] = classNames;
      if (node.type === 'CallExpression' && node.callee.type === 'SequenceExpression' && key(node.callee.expressions.at(-1)?.property) === 'useContext') bindings[node.arguments[0].name] ??= {};
    }
    Object.assign(bindings, additions);
    return compile(fn, bindings);
  };
  for (const name of ['Input', 'Attachments', 'Footer', 'FooterInlineControls', 'FooterControls', 'FooterActions', 'FooterAction', 'FooterExpandingControls', 'ReplyContext']) primitiveRenderers[name] = primitiveCompile(name);
  const adaptive = primitiveFunctions.AdaptiveFooter;
  const footerCall = adaptive.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'rows'));
  primitiveRenderers.AdaptiveFooter = primitiveCompile('AdaptiveFooter', { [footerCall.arguments[0].name]: primitiveRenderers.Footer });
  const surfaceCall = layoutRenderer.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'renderOwnSurface'));
  const surfaceRenderer = functionAt(initial, initial.indexOf(`function ${surfaceCall.arguments[0].name}(`) + 10);
  const surfaceBindings = { [member(surfaceRenderer, 'c')]: cache, [member(surfaceRenderer, 'jsx')]: jsx, [componentModule]: primitiveRenderers };
  const surfaceClass = surfaceRenderer.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => text(argument) === 'relative'));
  surfaceBindings[surfaceClass.callee.name] = classNames;
  const renderSurface = compile(surfaceRenderer, surfaceBindings);
  const layoutBindings = { [member(layoutRenderer, 'c')]: cache, [member(layoutRenderer, 'jsx')]: jsx,
    [member(layoutRenderer, 'useContext')]: { useContext: value => value }, [componentModule]: primitiveRenderers,
    ...contextValues, [surfaceCall.arguments[0].name]: renderSurface };
  for (const node of layoutRenderer.nodes) {
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.length === 2 && node.arguments.every(argument => argument.type === 'Identifier')) layoutBindings[node.callee.name] = noop;
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => text(argument).startsWith('text-base transition-'))) layoutBindings[node.callee.name] = classNames;
  }
  const layoutFn = compile(layoutRenderer, layoutBindings);
  const renderLayout = options => {
    fixtureIsHome = options.surfacePlacement.kind === 'home';
    try { return layoutFn(options); } finally { fixtureIsHome = false; }
  };
  const host = functionAt(primary, 'aboveHomeActionBarInRail:n,banners:r,bannersRef:i');
  const hostContexts = host.nodes.filter(node => node.type === 'CallExpression' && node.callee.type === 'SequenceExpression' &&
    key(node.callee.expressions.at(-1)?.property) === 'useContext').map(node => node.arguments[0].name);
  assert.equal(hostContexts.length, 3, 'Native quota/composer placement contexts changed');
  const hostValues = Object.fromEntries([[hostContexts[0], undefined], [hostContexts[1], 'default'], [hostContexts[2], { isFloatingChatSurface: false }]]);
  const hostBindings = { [member(host, 'c')]: cache, [member(host, 'jsx')]: jsx,
    [member(host, 'useContext')]: { useContext: value => value, Activity: props => props.children }, ...hostValues };
  for (const node of host.nodes) {
    if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments[0]?.type === 'Identifier') {
      hostBindings[node.callee.name] = () => false;
      hostBindings[node.arguments[0].name] = {};
    }
    if (node.type === 'CallExpression' && node.callee.type === 'SequenceExpression' && key(node.callee.expressions.at(-1)?.property) === 'createPortal') {
      hostBindings[node.callee.expressions.at(-1).object.name] = { createPortal: child => child };
    }
    if (node.type === 'CallExpression' && node.callee.type === 'SequenceExpression' && ['jsx', 'jsxs'].includes(key(node.callee.expressions.at(-1)?.property)) && node.arguments[0]?.type === 'Identifier') {
      hostBindings[node.arguments[0].name] = props => props.children;
    }
  }
  const renderHost = compile(host, hostBindings);
  const ownerClass = functionAt(primary, 'function Pht(').nodes.map(text).find(value => value === 'flex w-full flex-col gap-2');
  assert.ok(ownerClass, 'Native Pht composer/banners owner class changed');
  cached = { css, classes, banner, aside, placement, notice, renderBanner, renderButton,
    composerRoot, composerBody, composerClasses, renderComposerRoot, renderComposerBody, host, renderHost, renderLayout, layoutRenderer, surfaceRenderer,
    primitiveNames, ownerClass, sharedEntry, initialEntry, primaryEntry, cssEntries, layerOrder, primary, initial,
    functionAt: (kind, anchor) => functionAt({ shared, initial, primary }[kind], anchor) };
  return cached;
};

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
export const quotaHtml = tree => {
  if (tree == null || tree === false) return '';
  if (typeof tree === 'string' || typeof tree === 'number') return escape(tree);
  if (Array.isArray(tree)) return tree.map(quotaHtml).join('');
  const { tag, props } = tree;
  if (tag === '#fragment') return quotaHtml(props.children);
  const attributes = Object.entries(props).filter(([name, value]) => !['children', 'style', 'ref', 'initial', 'animate', 'transition', 'layoutId', 'layoutCrossfade', 'layout', 'layoutDependency'].includes(name) &&
    !name.startsWith('on') && value !== undefined && value !== false)
    .map(([name, value]) => `${name === 'className' ? 'class' : name}="${escape(value === true ? '' : value)}"`).join(' ');
  const style = props.style ? Object.entries(props.style).filter(([, value]) => value !== undefined).map(([name, value]) => `${name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}:${value}`).join(';') : '';
  return `<${tag} ${attributes}${style ? ` style="${escape(style)}"` : ''}>${quotaHtml(props.children)}</${tag}>`;
};
